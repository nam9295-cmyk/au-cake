import type { CustomCakeLookupRequest, CustomCakeLookupResponse } from './custom-cake-contract.js'
import type { createCakeWireRepository } from './custom-cake-repository.ts'
type Repository = ReturnType<typeof createCakeWireRepository>

/** Successful possession proof belongs to this screen only, never persistent storage. */
export function createAdminRequestSession() {
  let sequence = 0
  let proof: CustomCakeLookupRequest | undefined
  return {
    clear() { sequence++; proof = undefined },
    async search(repository: Repository, input: CustomCakeLookupRequest) {
      const current = ++sequence
      proof = undefined
      const captured = Object.freeze({ ...input })
      try {
        const snapshot = await repository.getCustomCakeRequest(captured)
        if (current !== sequence) return null
        proof = captured
        return snapshot
      } catch (error) {
        if (current !== sequence) return null
        throw error
      }
    },
    async mutate(repository: Repository, mutation: (repo: Repository) => Promise<CustomCakeLookupResponse>) {
      if (!proof) throw new Error('LOOKUP_REQUIRED')
      const captured = proof, current = sequence
      try {
        const snapshot = await mutation(repository)
        return current === sequence ? { snapshot, error: '' } : null
      } catch (error) {
        if (current !== sequence) return null
        const code = error instanceof Error ? error.message : 'CAKE_WIRE_UNAVAILABLE'
        if (code !== 'QUOTE_VERSION_CONFLICT' && code !== 'QUOTE_STATE_CONFLICT') throw error
        const snapshot = await repository.getCustomCakeRequest(captured)
        return current === sequence ? { snapshot, error: code } : null
      }
    },
  }
}
