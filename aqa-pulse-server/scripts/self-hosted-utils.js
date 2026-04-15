function parseEnvFile(text) {
    const values = {}

    for (const rawLine of text.split(/\r?\n/)) {
        const line = rawLine.trim()

        if (!line || line.startsWith('#')) {
            continue
        }

        const separatorIndex = line.indexOf('=')

        if (separatorIndex <= 0) {
            continue
        }

        const key = line.slice(0, separatorIndex).trim()
        const value = line.slice(separatorIndex + 1).trim()
        values[key] = value
    }

    return values
}

function normalizePort(value) {
    const parsed = normalizePositiveInteger(value)
    return parsed && parsed <= 65535 ? parsed : null
}

function normalizePositiveInteger(value) {
    if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
        return value
    }

    if (typeof value !== 'string' || value.trim().length === 0) {
        return null
    }

    const parsed = Number(value)
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function normalizeBaseUrl(value) {
    return value.trim().replace(/\/+$/, '')
}

module.exports = {
    parseEnvFile,
    normalizeBaseUrl,
    normalizePort,
    normalizePositiveInteger,
}