### Fixed

- Running `bun run dev` on Windows now resolves `.exe` binaries installed by Bun and skips POSIX file-mode permission checks on Windows temporary directories. Before, dev services failed to launch due to missing `.cmd` executables or directory mode 666 errors. ([#1142](https://github.com/nightly-labs/openbot/issues/1142), [#1143](https://github.com/nightly-labs/openbot/issues/1143))
