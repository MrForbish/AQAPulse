# aqa-pulse-client Removal Checklist

Этот файл фиксирует последний реальный removal scope для `aqa-pulse-client`.

## Current public npm surface

Пакет публикует только один entrypoint: `aqa-pulse-client` root export `.`.

Runtime exports, которые надо либо снять с поддержки, либо заменить перед удалением пакета:

- `renderDashboardHtml`
- `renderTestHistoryHtml`
- `renderMetricHeading`
- `METRIC_INFO_STYLES`
- `formatDate`
- `formatDuration`
- `formatPercent`
- `ru`

Type exports, которые сейчас тоже являются публичным контрактом пакета:

- `DashboardAdvancedMetrics`
- `DashboardAvailableFilters`
- `DashboardFilters`
- `DashboardKpis`
- `DashboardRunMetadata`
- `DashboardSummary`
- `TestHistoryConflict`
- `TestHistoryResponse`

## Replacement status

- `renderDashboardHtml` и `renderTestHistoryHtml`: replacement path уже определён через `aqa-pulse-server` или React/static runtime из `aqa-pulse`.
- `renderMetricHeading` и `METRIC_INFO_STYLES`: replacement есть только внутри React/runtime codebase; стабильного published replacement API пока нет.
- `formatDate`, `formatDuration`, `formatPercent`, `ru`: published replacement теперь есть в `aqa-pulse-browser`.
- `Dashboard*` и `TestHistory*` types: published replacement теперь есть в `aqa-pulse-browser`.

## Repo dependencies to remove before package deletion

- main monorepo smoke/build dependency уже снята: `aqa-pulse` больше не держит `smoke:compatibility-html`, а `aqa-pulse-server` больше не собирает и не пакует `aqa-pulse-client`
- remaining repo references должны остаться только в migration/docs и в самом deprecated package до финального удаления
- docs, которые всё ещё ведут пользователей через temporary compatibility path

## Removal gate checklist

1. Подтвердить, что ни один внешний consumer больше не использует root exports пакета.
2. Перевести всех non-renderer consumers на `aqa-pulse-browser`.
3. Найти published replacement или окончательное удаление для `renderMetricHeading` и `METRIC_INFO_STYLES`, если они всё ещё используются вне deprecated renderer path.
4. Перевести docs и quickstarts на финальную картину без compatibility package.
5. Удалить package metadata/build scripts и сам source tree `aqa-pulse-client` после зелёной compile/smoke в оставшемся monorepo.

## Final validation after removal

- `npm --prefix aqa-pulse run compile`
- `npm --prefix aqa-pulse run smoke:full` без compatibility step
- `npm --prefix aqa-pulse-server run build`
- self-hosted smoke или equivalent packaging verification