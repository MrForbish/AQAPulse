'use strict'

exports.renderDashboardHtml = require('./render-dashboard').renderDashboardHtml
exports.renderTestHistoryHtml = require('./render-test-history').renderTestHistoryHtml
exports.METRIC_INFO_STYLES = require('./render-metric-info').METRIC_INFO_STYLES
exports.renderMetricHeading = require('./render-metric-info').renderMetricHeading
exports.formatDate = require('./shared/formatting').formatDate
exports.formatDuration = require('./shared/formatting').formatDuration
exports.formatPercent = require('./shared/formatting').formatPercent
exports.ru = require('./shared/i18n/ru').ru
