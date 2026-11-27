/** The slice of Google Identity Services' `google.accounts.oauth2` this app uses. */
export interface TokenResponse {
  readonly access_token?: string
  /** Seconds the token lives, as a string or a number depending on the library version. */
  readonly expires_in?: string | number
  readonly error?: string
  readonly error_description?: string
}

export interface TokenClient {
  requestAccessToken(): void
}

export interface GisOauth2 {
  initTokenClient(config: {
    client_id: string
    scope: string
    callback: (response: TokenResponse) => void
    error_callback: (error: { type?: string; message?: string }) => void
  }): TokenClient
}
