export class ReservationApiError extends Error {
  constructor(code, status = 400) {
    super(code)
    this.name = 'ReservationApiError'
    this.code = code
    this.status = status
  }
}
