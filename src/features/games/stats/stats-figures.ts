// The numbers the dialog shows, whoever computed them: the server for an account, the browser for a guest.
export type StatsFigures = {
  played: number
  wins: number
  currentStreak: number
  maxStreak: number
  // Wins by guesses used: every key from 1 to the game's guess limit, zeros included. Keys are strings, as in the
  // server's JSON.
  distribution: Record<string, number>
}
