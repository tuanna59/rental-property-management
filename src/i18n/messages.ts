import enCommon from "./messages/en/common.json";
import enNavigation from "./messages/en/navigation.json";
import enPreferences from "./messages/en/preferences.json";
import enDashboard from "./messages/en/dashboard.json";
import enBuilding from "./messages/en/building.json";
import enTenants from "./messages/en/tenants.json";
import enUtilities from "./messages/en/utilities.json";
import enBilling from "./messages/en/billing.json";
import enOperations from "./messages/en/operations.json";
import enAssets from "./messages/en/assets.json";
import enReports from "./messages/en/reports.json";
import enProperty from "./messages/en/property.json";

import viCommon from "./messages/vi/common.json";
import viNavigation from "./messages/vi/navigation.json";
import viPreferences from "./messages/vi/preferences.json";
import viDashboard from "./messages/vi/dashboard.json";
import viBuilding from "./messages/vi/building.json";
import viTenants from "./messages/vi/tenants.json";
import viUtilities from "./messages/vi/utilities.json";
import viBilling from "./messages/vi/billing.json";
import viOperations from "./messages/vi/operations.json";
import viAssets from "./messages/vi/assets.json";
import viReports from "./messages/vi/reports.json";
import viProperty from "./messages/vi/property.json";

import type { AppLocale } from "./config";

const en = {
  common: enCommon,
  navigation: enNavigation,
  preferences: enPreferences,
  dashboard: enDashboard,
  building: enBuilding,
  tenants: enTenants,
  utilities: enUtilities,
  billing: enBilling,
  operations: enOperations,
  assets: enAssets,
  reports: enReports,
  property: enProperty,
};

const vi: typeof en = {
  common: viCommon,
  navigation: viNavigation,
  preferences: viPreferences,
  dashboard: viDashboard,
  building: viBuilding,
  tenants: viTenants,
  utilities: viUtilities,
  billing: viBilling,
  operations: viOperations,
  assets: viAssets,
  reports: viReports,
  property: viProperty,
};

export type AppMessages = typeof en;

export function getMessages(locale: AppLocale): AppMessages {
  return locale === "vi" ? vi : en;
}
