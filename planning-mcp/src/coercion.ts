/**
 * Type coercion rules for automatic transformations
 * Handles trivial conversions (string↔bigint, number↔string, camel↔snake, etc.)
 * without requiring LLM-generated adapter nodes
 */

import { TypeExpr } from "./ir.ts";

export type CoercionPlan =
  | { kind: "id" }  // No transformation needed
  | { kind: "scalar"; op: ScalarCoercionOp }
  | { kind: "array"; of: CoercionPlan }
  | { kind: "record"; fields: Record<string, CoercionPlan> }
  | { kind: "rename"; from: string; to: string };

export type ScalarCoercionOp =
  | "stringToBigInt"
  | "bigIntToString"
  | "numberToString"
  | "stringToNumber"
  | "boolToString"
  | "stringToBool"
  | "celsiusToFahrenheit"
  | "fahrenheitToCelsius"
  | "msToSeconds"
  | "secondsToMs"
  | "camelToSnake"
  | "snakeToCamel";

/**
 * Check if a type can be coerced to another type
 */
export function canCoerce(source: TypeExpr | undefined, target: TypeExpr | undefined): boolean {
  return tryPlanCoercion(source, target) !== null;
}

/**
 * Attempt to plan a coercion from source to target type
 * Returns null if no coercion is possible
 */
export function tryPlanCoercion(source: TypeExpr | undefined, target: TypeExpr | undefined): CoercionPlan | null {
  // Missing types - assume compatible
  if (!source || !target) {
    return { kind: "id" };
  }

  // Exact match - no coercion needed
  if (JSON.stringify(source) === JSON.stringify(target)) {
    return { kind: "id" };
  }

  // Scalar coercions
  if (source.kind === "Scalar" && target.kind === "Scalar") {
    return tryScalarCoercion(source.name, target.name);
  }

  // Array coercions - coerce elements
  if (source.kind === "Array" && target.kind === "Array") {
    const elementPlan = tryPlanCoercion(source.of, target.of);
    if (elementPlan) {
      return { kind: "array", of: elementPlan };
    }
    return null;
  }

  // Record coercions - field-by-field
  if (source.kind === "Record" && target.kind === "Record") {
    const fieldPlans: Record<string, CoercionPlan> = {};

    // Check all target fields
    for (const [targetField, targetType] of Object.entries(target.fields)) {
      // Try exact field name match first
      if (source.fields[targetField]) {
        const plan = tryPlanCoercion(source.fields[targetField], targetType);
        if (!plan) return null;
        fieldPlans[targetField] = plan;
      } else {
        // Try case conversions (camelCase <-> snake_case)
        const snakeField = camelToSnake(targetField);
        const camelField = snakeToCamel(targetField);

        if (source.fields[snakeField]) {
          const plan = tryPlanCoercion(source.fields[snakeField], targetType);
          if (!plan) return null;
          fieldPlans[targetField] = { kind: "rename", from: snakeField, to: targetField };
        } else if (source.fields[camelField]) {
          const plan = tryPlanCoercion(source.fields[camelField], targetType);
          if (!plan) return null;
          fieldPlans[targetField] = { kind: "rename", from: camelField, to: targetField };
        } else {
          // Required field missing
          return null;
        }
      }
    }

    return { kind: "record", fields: fieldPlans };
  }

  // Opaque types - check for known unit conversions
  if (source.kind === "Opaque" && target.kind === "Opaque") {
    const op = tryUnitCoercion(source.name, target.name);
    if (op) {
      return { kind: "scalar", op };
    }
  }

  return null;
}

/**
 * Try to find a scalar coercion operation
 */
function tryScalarCoercion(source: string, target: string): CoercionPlan | null {
  const key = `${source}->${target}`;

  const coercions: Record<string, ScalarCoercionOp> = {
    "String->Number": "stringToNumber",
    "Number->String": "numberToString",
    "String->Bool": "stringToBool",
    "Bool->String": "boolToString",
  };

  const op = coercions[key];
  if (op) {
    return { kind: "scalar", op };
  }

  return null;
}

/**
 * Try to find a unit conversion
 */
function tryUnitCoercion(source: string, target: string): ScalarCoercionOp | null {
  const key = `${source}->${target}`;

  const unitCoercions: Record<string, ScalarCoercionOp> = {
    "Celsius->Fahrenheit": "celsiusToFahrenheit",
    "Fahrenheit->Celsius": "fahrenheitToCelsius",
    "Milliseconds->Seconds": "msToSeconds",
    "Seconds->Milliseconds": "secondsToMs",
    "BigInt->String": "bigIntToString",
    "String->BigInt": "stringToBigInt",
  };

  return unitCoercions[key] || null;
}

/**
 * Convert camelCase to snake_case
 */
function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

/**
 * Convert snake_case to camelCase
 */
function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Generate inline code for a coercion plan
 * Returns a code expression that transforms the input value
 */
export function generateCoercionCode(plan: CoercionPlan, inputExpr: string, lang: "ts" | "go" | "py" = "ts"): string {
  switch (plan.kind) {
    case "id":
      return inputExpr;

    case "scalar":
      return generateScalarCoercion(plan.op, inputExpr, lang);

    case "array":
      if (lang === "ts") {
        const elemTransform = generateCoercionCode(plan.of, "x", lang);
        return `${inputExpr}.map(x => ${elemTransform})`;
      } else if (lang === "py") {
        const elemTransform = generateCoercionCode(plan.of, "x", lang);
        return `[${elemTransform} for x in ${inputExpr}]`;
      } else if (lang === "go") {
        // Go requires more verbose map logic
        return `/* array coercion for ${inputExpr} - implement map */`;
      }
      return inputExpr;

    case "record": {
      const fields = Object.entries(plan.fields)
        .map(([field, fieldPlan]) => {
          const transform = generateCoercionCode(fieldPlan, `${inputExpr}.${field}`, lang);
          return `${field}: ${transform}`;
        });

      if (lang === "ts") {
        return `{ ${fields.join(", ")} }`;
      } else if (lang === "py") {
        return `{ ${fields.join(", ")} }`;
      }
      return inputExpr;
    }

    case "rename":
      return `${inputExpr}.${plan.from}`;  // Access the original field name

    default:
      return inputExpr;
  }
}

/**
 * Generate code for a scalar coercion
 */
function generateScalarCoercion(op: ScalarCoercionOp, inputExpr: string, lang: "ts" | "go" | "py"): string {
  if (lang === "ts") {
    const tsCoercions: Record<ScalarCoercionOp, string> = {
      stringToNumber: `Number(${inputExpr})`,
      numberToString: `String(${inputExpr})`,
      stringToBool: `${inputExpr} === 'true'`,
      boolToString: `String(${inputExpr})`,
      stringToBigInt: `BigInt(${inputExpr})`,
      bigIntToString: `${inputExpr}.toString()`,
      celsiusToFahrenheit: `(${inputExpr} * 9/5) + 32`,
      fahrenheitToCelsius: `(${inputExpr} - 32) * 5/9`,
      msToSeconds: `${inputExpr} / 1000`,
      secondsToMs: `${inputExpr} * 1000`,
      camelToSnake: `${inputExpr}.replace(/[A-Z]/g, (l) => '_' + l.toLowerCase())`,
      snakeToCamel: `${inputExpr}.replace(/_([a-z])/g, (_, l) => l.toUpperCase())`,
    };
    return tsCoercions[op];
  } else if (lang === "py") {
    const pyCoercions: Record<ScalarCoercionOp, string> = {
      stringToNumber: `float(${inputExpr})`,
      numberToString: `str(${inputExpr})`,
      stringToBool: `${inputExpr}.lower() == 'true'`,
      boolToString: `str(${inputExpr})`,
      stringToBigInt: `int(${inputExpr})`,
      bigIntToString: `str(${inputExpr})`,
      celsiusToFahrenheit: `(${inputExpr} * 9/5) + 32`,
      fahrenheitToCelsius: `(${inputExpr} - 32) * 5/9`,
      msToSeconds: `${inputExpr} / 1000`,
      secondsToMs: `${inputExpr} * 1000`,
      camelToSnake: `re.sub(r'(?<!^)(?=[A-Z])', '_', ${inputExpr}).lower()`,
      snakeToCamel: `re.sub(r'_([a-z])', lambda m: m.group(1).upper(), ${inputExpr})`,
    };
    return pyCoercions[op];
  }

  return inputExpr;
}
