import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import { useTranslation } from 'react-i18next'
import type { GuessRead, TitleRead } from '@/api/generated/models'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ApiError } from '@/lib/api-client'
import { getErrorMessage } from '@/lib/error-messages'
import { cn } from '@/lib/utils'
import type { useGuess } from '../guess'
import { useTitleSearch } from './title-queries'

// The input's own limit, the server's (CONTRACTS, "Title search", AC-36).
const MAX_LENGTH = 100

// After these the picked title cannot be sent as it is (AC-55, AC-56); any other failure keeps it.
const PICK_REFUSED_CODES = new Set(['duplicate_guess', 'title_not_found'])

// A live region speaks when its text changes, so it stays empty this long after the text of the box changes.
const ANNOUNCE_DELAY_MS = 150

type TitleSearchProps = {
  slug: string
  guesses: GuessRead[]
  guess: ReturnType<typeof useGuess>
}

// A combobox after the ARIA authoring practices: the focus stays in the input, `aria-activedescendant` names the
// highlighted option. The list is the server's, in the server's order: nothing here filters or sorts it (AC-29).
export function TitleSearch({ slug, guesses, guess }: TitleSearchProps) {
  const { t } = useTranslation()
  const listId = useId()
  const messageId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const [text, setText] = useState('')
  const [picked, setPicked] = useState<TitleRead | null>(null)
  const [listOpen, setListOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(-1)
  // The pick as the latest event left it: a guess answers later, and must not clear what the player did meanwhile.
  const pickedRef = useRef<TitleRead | null>(null)
  // The text is a pick's name, until the player edits it: it needs no list and is never searched, also after a 422
  // clears the pick.
  const [fromPick, setFromPick] = useState(false)

  const search = useTitleSearch(slug, text, !fromPick)
  const open = listOpen && !fromPick
  const items = search.query.data?.items
  const showItems =
    search.searchable &&
    search.settled &&
    items !== undefined &&
    items.length > 0
  const options = showItems ? items : []
  // The list exists only with items; a message is not a listbox, so the box is then not expanded.
  const expanded = open && showItems
  // An answer can change under the highlight (a refetch), so it is checked against the list shown.
  const active = highlighted < options.length ? highlighted : -1

  const tried = new Set(guesses.map((guessed) => guessed.title_id))

  let message = ''
  if (!search.searchable) {
    message = t('games.search.too_short')
  } else if (!search.settled || search.query.isPending) {
    message = t('games.search.loading')
  } else if (search.query.isError) {
    // A refusal (429, 403) has its own text; a server or network failure is just "Search failed".
    const error = search.query.error
    message =
      error instanceof ApiError && error.status >= 400 && error.status < 500
        ? getErrorMessage(error, t, 'games.search.failed')
        : t('games.search.failed')
  } else if (!showItems) {
    message = t('games.search.empty')
  }

  // The list scrolls inside itself: keep the highlighted option in view, also when the list opens or its items change.
  useEffect(() => {
    const list = listRef.current
    const option = list?.children[active]
    if (!list || !(option instanceof HTMLElement)) return
    const bottom = option.offsetTop + option.offsetHeight
    if (option.offsetTop < list.scrollTop) list.scrollTop = option.offsetTop
    else if (bottom > list.scrollTop + list.clientHeight) {
      list.scrollTop = bottom - list.clientHeight
    }
  }, [active, expanded, search.query.data])

  // Announced once the answer for the text in the box has been in for a moment: the region is empty meanwhile, so the
  // same count for another text is heard again.
  const count = expanded ? options.length : null
  const announceKey = count === null ? null : `${search.trimmed}|${count}`
  const [announced, setAnnounced] = useState<{
    key: string
    text: string
  } | null>(null)
  useEffect(() => {
    if (announceKey === null || count === null) return
    const timer = setTimeout(
      () =>
        setAnnounced({
          key: announceKey,
          text: t('games.search.count', { count }),
        }),
      ANNOUNCE_DELAY_MS,
    )
    return () => clearTimeout(timer)
  }, [announceKey, count, t])
  const announcement = announced?.key === announceKey ? announced.text : ''

  function choose(title: TitleRead | null) {
    pickedRef.current = title
    setPicked(title)
  }

  function pick(title: TitleRead) {
    if (tried.has(title.id)) return
    setText(title.name)
    choose(title)
    setFromPick(true)
    setListOpen(false)
    setHighlighted(-1)
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    // The keys of a composition (an IME picking a candidate) are the IME's. Safari ends one with keyCode 229 after
    // `isComposing` is already false.
    if (event.nativeEvent.isComposing || event.keyCode === 229) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (fromPick) return
      setListOpen(true)
      if (options.length === 0) return
      // From no highlight, Down goes to the first option and Up to the last.
      const down = event.key === 'ArrowDown'
      setHighlighted(
        active < 0
          ? down
            ? 0
            : options.length - 1
          : (active + (down ? 1 : -1) + options.length) % options.length,
      )
    } else if (event.key === 'Enter' && open && active >= 0) {
      // Picking is not submitting: a second Enter sends the guess.
      event.preventDefault()
      pick(options[active])
    } else if (event.key === 'Escape' && open) {
      event.preventDefault()
      setListOpen(false)
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (picked === null) return
    const sent = picked
    // The player may have typed or picked something else while the guess was on its way.
    const stillSent = () => pickedRef.current?.id === sent.id
    guess.send(sent.id, {
      onSuccess: (answer) => {
        if (answer.status !== 'in_progress' || !stillSent()) return
        setText('')
        setFromPick(false)
        choose(null)
        inputRef.current?.focus()
      },
      onError: (error) => {
        if (
          error instanceof ApiError &&
          PICK_REFUSED_CODES.has(error.code) &&
          stillSent()
        ) {
          choose(null)
        }
      },
    })
  }

  return (
    <form onSubmit={onSubmit} className="flex items-start gap-2">
      <div className="relative min-w-0 flex-1">
        <Input
          ref={inputRef}
          role="combobox"
          aria-label={t('games.search.label')}
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-controls={expanded ? listId : undefined}
          aria-describedby={open && !showItems ? messageId : undefined}
          aria-activedescendant={
            expanded && active >= 0 ? `${listId}-${active}` : undefined
          }
          autoComplete="off"
          spellCheck={false}
          maxLength={MAX_LENGTH}
          placeholder={t('games.search.placeholder')}
          className="max-md:h-11"
          value={text}
          onChange={(event) => {
            setText(event.target.value)
            choose(null)
            setFromPick(false)
            setListOpen(true)
            setHighlighted(-1)
          }}
          onKeyDown={onKeyDown}
          onClick={() => setListOpen(true)}
          onBlur={() => setListOpen(false)}
        />
        {/* A press on the list must not take the focus from the input, or its blur would close the list first. */}
        {open && (
          <div
            onMouseDown={(event) => event.preventDefault()}
            className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-md"
          >
            {showItems ? (
              <ul
                ref={listRef}
                id={listId}
                role="listbox"
                aria-label={t('games.search.label')}
                className="relative max-h-60 overflow-y-auto overscroll-contain"
              >
                {options.map((title, index) => {
                  const isTried = tried.has(title.id)
                  const details = [title.year, title.franchise]
                    .filter((part) => part !== null)
                    .join(' · ')
                  return (
                    <li
                      key={title.id}
                      id={`${listId}-${index}`}
                      role="option"
                      aria-selected={index === active}
                      aria-disabled={isTried}
                      onClick={() => pick(title)}
                      className={cn(
                        'flex min-h-9 cursor-pointer items-center gap-2 px-2.5 py-1.5 text-sm max-md:min-h-11',
                        index === active && 'bg-accent text-accent-foreground',
                        isTried && 'cursor-not-allowed opacity-60',
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{title.name}</span>
                        {details && (
                          <span className="block truncate text-xs text-muted-foreground">
                            {details}
                          </span>
                        )}
                      </span>
                      {isTried && (
                        <span className="shrink-0 text-xs font-medium">
                          {t('games.search.tried')}
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p
                id={messageId}
                className="px-2.5 py-2 text-sm text-muted-foreground"
              >
                {message}
              </p>
            )}
          </div>
        )}
        <div className="sr-only" aria-live="polite">
          {announcement}
        </div>
      </div>
      {/* aria-disabled, not disabled, so the focus stays on the button (AC-16, AC-32). */}
      <Button
        type="submit"
        aria-disabled={picked === null || guess.isPending}
        className="max-md:h-11"
      >
        {t('games.submit')}
      </Button>
    </form>
  )
}
