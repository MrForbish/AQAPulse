"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ru = exports.formatPercent = exports.formatDuration = exports.formatDate = exports.METRIC_INFO_STYLES = void 0;
exports.renderDashboardHtml = renderDashboardHtml;
exports.renderTestHistoryHtml = renderTestHistoryHtml;
exports.renderMetricHeading = renderMetricHeading;
const render_dashboard_1 = require("./render-dashboard");
const render_metric_info_1 = require("./render-metric-info");
const render_test_history_1 = require("./render-test-history");
const formatting_1 = require("./shared/formatting");
Object.defineProperty(exports, "formatDate", { enumerable: true, get: function () { return formatting_1.formatDate; } });
Object.defineProperty(exports, "formatDuration", { enumerable: true, get: function () { return formatting_1.formatDuration; } });
Object.defineProperty(exports, "formatPercent", { enumerable: true, get: function () { return formatting_1.formatPercent; } });
const ru_1 = require("./shared/i18n/ru");
Object.defineProperty(exports, "ru", { enumerable: true, get: function () { return ru_1.ru; } });
let didWarnAboutDeprecatedPackage = false;
function warnDeprecatedPackage(apiName) {
    if (didWarnAboutDeprecatedPackage) {
        return;
    }
    didWarnAboutDeprecatedPackage = true;
    console.warn(`[AQA Pulse] aqa-pulse-client is a deprecated compatibility package scheduled for removal. ${apiName} still uses the old HTML renderer flow; migrate to aqa-pulse-server or the React/static runtime before this package is retired.`);
}
function renderDashboardHtml(...args) {
    warnDeprecatedPackage('renderDashboardHtml');
    return (0, render_dashboard_1.renderDashboardHtml)(...args);
}
function renderTestHistoryHtml(...args) {
    warnDeprecatedPackage('renderTestHistoryHtml');
    return (0, render_test_history_1.renderTestHistoryHtml)(...args);
}
function renderMetricHeading(...args) {
    warnDeprecatedPackage('renderMetricHeading');
    return (0, render_metric_info_1.renderMetricHeading)(...args);
}
exports.METRIC_INFO_STYLES = (() => {
    warnDeprecatedPackage('METRIC_INFO_STYLES');
    return render_metric_info_1.METRIC_INFO_STYLES;
})();
