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
import type * as bankAccounts from "../bankAccounts.js";
import type * as categories from "../categories.js";
import type * as constants from "../constants.js";
import type * as creditCards from "../creditCards.js";
import type * as dashboard from "../dashboard.js";
import type * as expenses from "../expenses.js";
import type * as gstLedger from "../gstLedger.js";
import type * as importData from "../importData.js";
import type * as income from "../income.js";
import type * as insurance from "../insurance.js";
import type * as investments from "../investments.js";
import type * as invoices from "../invoices.js";
import type * as loans from "../loans.js";
import type * as reconciliation from "../reconciliation.js";
import type * as reminders from "../reminders.js";
import type * as reports from "../reports.js";
import type * as subscriptions from "../subscriptions.js";
import type * as tax from "../tax.js";
import type * as users from "../users.js";
import type * as vault from "../vault.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  bankAccounts: typeof bankAccounts;
  categories: typeof categories;
  constants: typeof constants;
  creditCards: typeof creditCards;
  dashboard: typeof dashboard;
  expenses: typeof expenses;
  gstLedger: typeof gstLedger;
  importData: typeof importData;
  income: typeof income;
  insurance: typeof insurance;
  investments: typeof investments;
  invoices: typeof invoices;
  loans: typeof loans;
  reconciliation: typeof reconciliation;
  reminders: typeof reminders;
  reports: typeof reports;
  subscriptions: typeof subscriptions;
  tax: typeof tax;
  users: typeof users;
  vault: typeof vault;
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
