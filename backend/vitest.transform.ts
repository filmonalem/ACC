import swcPlugin from 'unplugin-swc';

/**
 * Shared transform for every vitest config.
 *
 * The decorator metadata problem, in full, because it is not obvious:
 *
 * `tsconfig.json` sets both `experimentalDecorators` and
 * `emitDecoratorMetadata`, and the whole dependency-injection system depends on
 * the second one. It is what makes `@Injectable()` record a constructor's
 * *runtime* parameter types, which is how Nest knows `JwtAuthGuard` needs
 * `Reflector`, `JwtService` and `ACC_ENV`.
 *
 * Vitest transforms with esbuild, and esbuild does not implement
 * `emitDecoratorMetadata`. It strips the types and keeps the decorators, so
 * every provider compiles fine and then fails at runtime with
 * "Nest can't resolve dependencies of the JwtAuthGuard (?)" — the `?` is the
 * clue: Nest received no types at all.
 *
 * SWC does emit the metadata, so it replaces esbuild for test files. This is a
 * test-tooling constraint only; `nest build` uses `tsc` and is unaffected.
 */
export function swcTransform() {
  // Options are inferred from tsconfig.json, which is the safer arrangement:
  // `experimentalDecorators` and `emitDecoratorMetadata` are read from there,
  // so the test transform cannot drift away from the compiler settings that
  // `nest build` actually uses.
  return swcPlugin.vite();
}