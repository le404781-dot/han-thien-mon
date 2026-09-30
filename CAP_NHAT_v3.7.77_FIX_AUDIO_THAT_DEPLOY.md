# v3.7.77 – Fix audio asset deployment

- Duplicates the four audio assets at project root and under assets/audio.
- Server searches root audio first, then assets/audio.
- /api/audio-health reports the resolved path.
- Keeps Range 206, correct Content-Type, and no-cache audio delivery.
- This avoids deployments that omit or relocate nested binary assets.
