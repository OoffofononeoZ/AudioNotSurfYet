import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

const validatorPath = fileURLToPath(
  new URL(
    '../../skills/visualizer-scene-generator/scripts/validate-scene-brief.mjs',
    import.meta.url,
  ),
)
const temporaryDirectories: string[] = []

function completeBrief() {
  return {
    schemaVersion: 1,
    requestedName: 'Pulse Garden',
    primaryEffect: {
      appearance: 'A field of luminous columns',
      spatialStructure: 'Columns form a seeded radial garden around the origin',
      primaryMotion: 'Columns grow and fade without translating',
      drivenProperty: 'column height and emissive brightness',
      binding: {
        dataType: 'analysis-vector',
        response: {
          lowOrInactive: 'short dim columns remain visible',
          highOrActive: 'assigned columns become tall and bright',
          vectorMapping: 'split the vector into one maximum-valued band per column',
        },
        time: {
          mode: 'attack-release',
          attackSeconds: 0.04,
          releaseSeconds: 0.2,
        },
      },
    },
    decorativeEffects: [
      {
        style: 'A seeded ring rotates around the garden',
        parameters: [
          {
            name: 'ringSpeed',
            visualProperty: 'angular velocity',
            binding: {
              dataType: 'analysis-scalar',
              response: {
                lowOrInactive: 'the ring rotates slowly',
                highOrActive: 'the ring rotates quickly',
              },
              time: {
                mode: 'integrated',
                speedUnit: 'radians per second',
                boundaryBehavior: 'wrap at two pi',
              },
            },
          },
        ],
      },
    ],
    referenceImages: [{ source: 'pulse-garden.png', role: 'inspiration' }],
    preferences: { palette: 'black, mint, and white' },
  }
}

function runValidator(brief: unknown) {
  const directory = mkdtempSync(join(tmpdir(), 'visualizer-scene-brief-'))
  temporaryDirectories.push(directory)
  const inputPath = join(directory, 'brief.json')
  const serialized = `${JSON.stringify(brief, null, 2)}\n`
  writeFileSync(inputPath, serialized, 'utf8')

  const result = spawnSync(process.execPath, [validatorPath, inputPath], {
    encoding: 'utf8',
  })

  return {
    directory,
    inputPath,
    serialized,
    exitCode: result.status,
    stderr: result.stderr,
    output: JSON.parse(result.stdout),
  }
}

function errorPaths(output: { errors: Array<{ path: string }> }) {
  return output.errors.map((error) => error.path)
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('Visualizer SceneBriefV1 validator', () => {
  it('accepts a complete brief without writing side-effect files', () => {
    const result = runValidator(completeBrief())

    expect(result.exitCode).toBe(0)
    expect(result.stderr).toBe('')
    expect(result.output).toMatchObject({
      status: 'READY_FOR_CONTRACT',
      errors: [],
      summary: {
        bindingDataType: 'analysis-vector',
        timeBehavior: 'attack-release',
        decorativeEffectCount: 1,
        referenceImageCount: 1,
      },
    })
    expect(readFileSync(result.inputPath, 'utf8')).toBe(result.serialized)
    expect(readdirSync(result.directory)).toEqual(['brief.json'])
  })

  it('rejects a missing primary effect', () => {
    const result = runValidator({ schemaVersion: 1 })

    expect(result.exitCode).toBe(2)
    expect(result.output.status).toBe('INPUT_INCOMPLETE')
    expect(errorPaths(result.output)).toContain('$.primaryEffect')
  })

  it('rejects a missing binding data type', () => {
    const brief = completeBrief()
    delete (brief.primaryEffect.binding as { dataType?: string }).dataType
    const result = runValidator(brief)

    expect(result.exitCode).toBe(2)
    expect(errorPaths(result.output)).toContain('$.primaryEffect.binding.dataType')
  })

  it('rejects missing response semantics', () => {
    const brief = completeBrief()
    delete (brief.primaryEffect.binding as { response?: unknown }).response
    const result = runValidator(brief)

    expect(result.exitCode).toBe(2)
    expect(errorPaths(result.output)).toContain('$.primaryEffect.binding.response')
  })

  it('rejects invalid binding, time, and image-role enums', () => {
    const brief = completeBrief()
    ;(brief.primaryEffect.binding as { dataType: string }).dataType = 'audio'
    ;(brief.primaryEffect.binding.time as { mode: string }).mode = 'raf-delta'
    ;(brief.referenceImages[0] as { role: string }).role = 'instruction'
    const result = runValidator(brief)

    expect(result.exitCode).toBe(2)
    expect(errorPaths(result.output)).toEqual(
      expect.arrayContaining([
        '$.primaryEffect.binding.dataType',
        '$.primaryEffect.binding.time.mode',
        '$.referenceImages[0].role',
      ]),
    )
  })

  it('rejects an incomplete decorative binding', () => {
    const brief = completeBrief()
    brief.decorativeEffects[0].parameters[0].binding = {
      dataType: 'analysis-scalar',
    } as never
    const result = runValidator(brief)

    expect(result.exitCode).toBe(2)
    expect(errorPaths(result.output)).toEqual(
      expect.arrayContaining([
        '$.decorativeEffects[0].parameters[0].binding.response',
        '$.decorativeEffects[0].parameters[0].binding.time',
      ]),
    )
  })

  it('requires vector distribution and integrated movement boundaries', () => {
    const brief = completeBrief()
    delete (brief.primaryEffect.binding.response as { vectorMapping?: string }).vectorMapping
    brief.primaryEffect.binding.time = { mode: 'integrated' } as never
    const result = runValidator(brief)

    expect(result.exitCode).toBe(2)
    expect(errorPaths(result.output)).toEqual(
      expect.arrayContaining([
        '$.primaryEffect.binding.response.vectorMapping',
        '$.primaryEffect.binding.time.speedUnit',
        '$.primaryEffect.binding.time.boundaryBehavior',
      ]),
    )
  })
})
