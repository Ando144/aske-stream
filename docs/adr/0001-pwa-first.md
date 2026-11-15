# 0001 — PWA first, native Android later

**Status:** accepted

## Context

Requirements: reliable background playback with lock-screen controls, an offline cache with
rotation, R2 streaming, and a portfolio project anyone can try. The owner uses Android and has no Mac.

## Options

|                                        | PWA                                  | Native Android (Kotlin + Media3) | Flutter / React Native                         |
| -------------------------------------- | ------------------------------------ | -------------------------------- | ---------------------------------------------- |
| Background audio, Android              | Good (media element + Media Session) | Excellent                        | Excellent                                      |
| Background audio, iOS                  | Unreliable on iOS 26                 | n/a                              | Good, but needs a Mac and a paid Apple account |
| Rotation while app is closed           | No                                   | Yes (WorkManager)                | Yes                                            |
| Try it from a link / deploy for anyone | Yes                                  | APK                              | Store / APK                                    |

## Decision

Ship a PWA (React + Vite) served by the same Worker as the API. Keep the API client-agnostic so a
native Android client can be added later for background rotation.

## Consequences

Rotation runs only while the app is open (start, reconnect, every 30 min, after songs). iOS is
explicitly out of scope for background audio.
