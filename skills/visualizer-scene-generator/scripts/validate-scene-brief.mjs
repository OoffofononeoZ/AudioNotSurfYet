#!/usr/bin/env node

import { readFileSync } from 'node:fs'

const DATA_TYPES = new Set([
  'analysis-scalar',
  'analysis-vector',
  'editor-point',
  'editor-range',
])
const TIME_MODES = new Set(['direct', 'attack-release', 'integrated'])
const IMAGE_ROLES = new Set(['inspiration', 'priority-match'])
const TOP_LEVEL_KEYS = new Set([
  'schemaVersion',
  'requestedName',
  'primaryEffect',
  'decorativeEffects',
  'referenceImages',
  'preferences',
])
const PRIMARY_KEYS = new Set([
  'appearance',
  'spatialStructure',
  'primaryMotion',
  'drivenProperty',
  'binding',
])
const BINDING_KEYS = new Set(['dataType', 'response', 'time'])
const RESPONSE_KEYS = new Set(['lowOrInactive', 'highOrActive', 'vectorMapping'])
const TIME_KEYS = new Set([
  'mode',
  'attackSeconds',
  'releaseSeconds',
  'speedUnit',
  'boundaryBehavior',
])
const DECORATION_KEYS = new Set(['style', 'parameters'])
const DECORATION_PARAMETER_KEYS = new Set(['name', 'visualProperty', 'binding'])
const IMAGE_KEYS = new Set(['source', 'role'])
const PREFERENCE_KEYS = new Set([
  'palette',
  'background',
  'camera',
  'density',
  'motionRhythm',
  'reducedMotion',
  'targetFixture',
  'performancePriority',
])

const issues = []

function addIssue(path, message) {
  issues.push({ path, message })
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function checkUnknownKeys(value, allowedKeys, path) {
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      addIssue(`${path}.${key}`, 'unknown field')
    }
  }
}

function requireText(value, path) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    addIssue(path, 'must be a non-empty string')
    return false
  }
  return true
}

function validateResponse(value, path, dataType) {
  if (!isRecord(value)) {
    addIssue(path, 'is required and must be an object')
    return
  }

  checkUnknownKeys(value, RESPONSE_KEYS, path)
  requireText(value.lowOrInactive, `${path}.lowOrInactive`)
  requireText(value.highOrActive, `${path}.highOrActive`)

  if (dataType === 'analysis-vector') {
    requireText(value.vectorMapping, `${path}.vectorMapping`)
  } else if (value.vectorMapping !== undefined) {
    requireText(value.vectorMapping, `${path}.vectorMapping`)
  }
}

function validateOptionalSeconds(value, path) {
  if (value === undefined) return
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    addIssue(path, 'must be a finite number greater than or equal to 0')
  }
}

function validateTime(value, path) {
  if (!isRecord(value)) {
    addIssue(path, 'is required and must be an object')
    return
  }

  checkUnknownKeys(value, TIME_KEYS, path)
  const mode = value.mode
  if (!TIME_MODES.has(mode)) {
    addIssue(`${path}.mode`, 'must be direct, attack-release, or integrated')
  }

  validateOptionalSeconds(value.attackSeconds, `${path}.attackSeconds`)
  validateOptionalSeconds(value.releaseSeconds, `${path}.releaseSeconds`)

  if (mode === 'integrated') {
    requireText(value.speedUnit, `${path}.speedUnit`)
    requireText(value.boundaryBehavior, `${path}.boundaryBehavior`)
  } else {
    if (value.speedUnit !== undefined) requireText(value.speedUnit, `${path}.speedUnit`)
    if (value.boundaryBehavior !== undefined) {
      requireText(value.boundaryBehavior, `${path}.boundaryBehavior`)
    }
  }
}

function validateBinding(value, path) {
  if (!isRecord(value)) {
    addIssue(path, 'is required and must be an object')
    return
  }

  checkUnknownKeys(value, BINDING_KEYS, path)
  const dataType = value.dataType
  if (!DATA_TYPES.has(dataType)) {
    addIssue(
      `${path}.dataType`,
      'must be analysis-scalar, analysis-vector, editor-point, or editor-range',
    )
  }
  validateResponse(value.response, `${path}.response`, dataType)
  validateTime(value.time, `${path}.time`)
}

function validatePrimaryEffect(value) {
  if (!isRecord(value)) {
    addIssue('$.primaryEffect', 'is required and must be an object')
    return
  }

  checkUnknownKeys(value, PRIMARY_KEYS, '$.primaryEffect')
  requireText(value.appearance, '$.primaryEffect.appearance')
  requireText(value.spatialStructure, '$.primaryEffect.spatialStructure')
  requireText(value.primaryMotion, '$.primaryEffect.primaryMotion')
  requireText(value.drivenProperty, '$.primaryEffect.drivenProperty')
  validateBinding(value.binding, '$.primaryEffect.binding')
}

function validateDecorativeEffects(value) {
  if (value === undefined) return
  if (!Array.isArray(value)) {
    addIssue('$.decorativeEffects', 'must be an array when provided')
    return
  }

  value.forEach((effect, effectIndex) => {
    const effectPath = `$.decorativeEffects[${effectIndex}]`
    if (!isRecord(effect)) {
      addIssue(effectPath, 'must be an object')
      return
    }

    checkUnknownKeys(effect, DECORATION_KEYS, effectPath)
    requireText(effect.style, `${effectPath}.style`)
    if (!Array.isArray(effect.parameters) || effect.parameters.length === 0) {
      addIssue(`${effectPath}.parameters`, 'must contain at least one editable parameter')
      return
    }

    effect.parameters.forEach((parameter, parameterIndex) => {
      const parameterPath = `${effectPath}.parameters[${parameterIndex}]`
      if (!isRecord(parameter)) {
        addIssue(parameterPath, 'must be an object')
        return
      }

      checkUnknownKeys(parameter, DECORATION_PARAMETER_KEYS, parameterPath)
      requireText(parameter.name, `${parameterPath}.name`)
      requireText(parameter.visualProperty, `${parameterPath}.visualProperty`)
      if (parameter.binding !== undefined) {
        validateBinding(parameter.binding, `${parameterPath}.binding`)
      }
    })
  })
}

function validateReferenceImages(value) {
  if (value === undefined) return
  if (!Array.isArray(value)) {
    addIssue('$.referenceImages', 'must be an array when provided')
    return
  }

  value.forEach((reference, index) => {
    const path = `$.referenceImages[${index}]`
    if (!isRecord(reference)) {
      addIssue(path, 'must be an object')
      return
    }

    checkUnknownKeys(reference, IMAGE_KEYS, path)
    requireText(reference.source, `${path}.source`)
    if (!IMAGE_ROLES.has(reference.role)) {
      addIssue(`${path}.role`, 'must be inspiration or priority-match')
    }
  })
}

function validatePreferences(value) {
  if (value === undefined) return
  if (!isRecord(value)) {
    addIssue('$.preferences', 'must be an object when provided')
    return
  }

  checkUnknownKeys(value, PREFERENCE_KEYS, '$.preferences')
  for (const key of Object.keys(value)) {
    requireText(value[key], `$.preferences.${key}`)
  }
}

function validateBrief(value) {
  if (!isRecord(value)) {
    addIssue('$', 'brief must be a JSON object')
    return
  }

  checkUnknownKeys(value, TOP_LEVEL_KEYS, '$')
  if (value.schemaVersion !== 1) {
    addIssue('$.schemaVersion', 'must equal 1')
  }
  if (value.requestedName !== undefined) {
    requireText(value.requestedName, '$.requestedName')
  }
  validatePrimaryEffect(value.primaryEffect)
  validateDecorativeEffects(value.decorativeEffects)
  validateReferenceImages(value.referenceImages)
  validatePreferences(value.preferences)
}

function printResult(result) {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
}

const inputPath = process.argv[2]
if (!inputPath || process.argv.length !== 3) {
  printResult({
    status: 'INPUT_INCOMPLETE',
    errors: [{ path: '$', message: 'usage: validate-scene-brief.mjs <brief.json>' }],
  })
  process.exitCode = 2
} else {
  let brief
  try {
    brief = JSON.parse(readFileSync(inputPath, 'utf8'))
  } catch (error) {
    printResult({
      status: 'INPUT_INCOMPLETE',
      errors: [
        {
          path: '$',
          message: error instanceof Error ? `cannot read valid JSON: ${error.message}` : 'cannot read valid JSON',
        },
      ],
    })
    process.exitCode = 2
  }

  if (brief !== undefined) {
    validateBrief(brief)
    if (issues.length > 0) {
      printResult({ status: 'INPUT_INCOMPLETE', errors: issues })
      process.exitCode = 2
    } else {
      printResult({
        status: 'READY_FOR_CONTRACT',
        errors: [],
        summary: {
          bindingDataType: brief.primaryEffect.binding.dataType,
          timeBehavior: brief.primaryEffect.binding.time.mode,
          decorativeEffectCount: brief.decorativeEffects?.length ?? 0,
          referenceImageCount: brief.referenceImages?.length ?? 0,
        },
      })
    }
  }
}
