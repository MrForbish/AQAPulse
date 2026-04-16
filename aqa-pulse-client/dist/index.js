'use strict'

const renderDashboardModule = require('./render-dashboard')
const renderTestHistoryModule = require('./render-test-history')
const metricInfoModule = require('./render-metric-info')
const formattingModule = require('./shared/formatting')
const i18nModule = require('./shared/i18n/ru')

let didWarnAboutLegacyPackage = false

function warnLegacyPackage(apiName) {
    if (didWarnAboutLegacyPackage) {
        return
    }

    didWarnAboutLegacyPackage = true
    console.warn('[AQA Pulse] aqa-pulse-client is a legacy compatibility package. ' + apiName + ' uses the old HTML renderer flow; new UI work ships through the React runtime in aqa-pulse-server.')
}

exports.renderDashboardHtml = (...args) => {
    warnLegacyPackage('renderDashboardHtml')
    return renderDashboardModule.renderDashboardHtml(...args)
}

exports.renderTestHistoryHtml = (...args) => {
    warnLegacyPackage('renderTestHistoryHtml')
    return renderTestHistoryModule.renderTestHistoryHtml(...args)
}

Object.defineProperty(exports, 'METRIC_INFO_STYLES', {
    enumerable: true,
    get() {
        warnLegacyPackage('METRIC_INFO_STYLES')
        return metricInfoModule.METRIC_INFO_STYLES
    },
})

exports.renderMetricHeading = (...args) => {
    warnLegacyPackage('renderMetricHeading')
    return metricInfoModule.renderMetricHeading(...args)
}

exports.formatDate = formattingModule.formatDate
exports.formatDuration = formattingModule.formatDuration
exports.formatPercent = formattingModule.formatPercent
exports.ru = i18nModule.ru
