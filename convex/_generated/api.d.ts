/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as constants from "../constants.js";
import type * as dashboard from "../dashboard.js";
import type * as expenses from "../expenses.js";
import type * as importData from "../importData.js";
import type * as income from "../income.js";
import type * as insurance from "../insurance.js";
import type * as investments from "../investments.js";
import type * as loans from "../loans.js";
import type * as reminders from "../reminders.js";
import type * as tax from "../tax.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  constants: typeof constants;
  dashboard: typeof dashboard;
  expenses: typeof expenses;
  importData: typeof importData;
  income: typeof income;
  insurance: typeof insurance;
  investments: typeof investments;
  loans: typeof loans;
  reminders: typeof reminders;
  tax: typeof tax;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
