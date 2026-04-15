# AQA Pulse Architecture Diagrams

Ниже собраны block-схемы по текущему состоянию проекта: пакеты, backend runtime, ingestion, auth и SSR/read path.

Палитра ниже адаптирована под тёмную тему: фон, подписи, границы и стрелки выставлены явно, чтобы схемы не терялись на dark background.

## Legend / Color Map

```mermaid
%%{init: {
    "theme": "base",
    "themeVariables": {
        "background": "#0d1117",
        "primaryColor": "#161b22",
        "primaryTextColor": "#e6edf3",
        "primaryBorderColor": "#3d444d",
        "secondaryColor": "#161b22",
        "secondaryTextColor": "#e6edf3",
        "secondaryBorderColor": "#3d444d",
        "tertiaryColor": "#161b22",
        "tertiaryTextColor": "#e6edf3",
        "tertiaryBorderColor": "#3d444d",
        "lineColor": "#8b949e",
        "textColor": "#e6edf3",
        "mainBkg": "#161b22",
        "clusterBkg": "#0d1117",
        "clusterBorder": "#3d444d",
        "edgeLabelBackground": "#161b22"
    }
}}%%
flowchart LR
        EXT[External / entry points]
        RUN[Runtime / app layer]
        DATA[(Storage / persisted data)]
        UI[UI / SSR / HTML]
        AUTH[Auth / token flow]
        UTIL[Helpers / analytics]

        classDef external fill:#1f6feb,stroke:#79c0ff,color:#ffffff,stroke-width:2px;
        classDef runtime fill:#238636,stroke:#56d364,color:#ffffff,stroke-width:2px;
        classDef data fill:#8957e5,stroke:#b392f0,color:#ffffff,stroke-width:2px;
        classDef ui fill:#9e6a03,stroke:#e3b341,color:#ffffff,stroke-width:2px;
        classDef auth fill:#da3633,stroke:#ff7b72,color:#ffffff,stroke-width:2px;
        classDef util fill:#0f766e,stroke:#5eead4,color:#ffffff,stroke-width:2px;

        class EXT external;
        class RUN runtime;
        class DATA data;
        class UI ui;
        class AUTH auth;
        class UTIL util;
        linkStyle default stroke:#8b949e,stroke-width:2px;
```

## 1. Repo / Package Overview

```mermaid
%%{init: {
    "theme": "base",
    "themeVariables": {
        "background": "#0d1117",
        "primaryColor": "#161b22",
        "primaryTextColor": "#e6edf3",
        "primaryBorderColor": "#3d444d",
        "secondaryColor": "#161b22",
        "secondaryTextColor": "#e6edf3",
        "secondaryBorderColor": "#3d444d",
        "tertiaryColor": "#161b22",
        "tertiaryTextColor": "#e6edf3",
        "tertiaryBorderColor": "#3d444d",
        "lineColor": "#8b949e",
        "textColor": "#e6edf3",
        "mainBkg": "#161b22",
        "clusterBkg": "#0d1117",
        "clusterBorder": "#3d444d",
        "edgeLabelBackground": "#161b22"
    }
}}%%
flowchart LR
        CI[Playwright CI / data.json] --> SERVER[aqa-pulse-server]
        USER[Browser User] --> SERVER

        subgraph Repo[AQAPulse repo]
                COREPKG[aqa-pulse\ncore analytics + SSR renderers + backend runtime]
                SERVERPKG[aqa-pulse-server\nself-hosted bundle + Docker + docs]
                CLIENTPKG[aqa-pulse-client\nclient package / packaging]
        end

        SERVERPKG -. build/runtime bundle from .-> COREPKG
        SERVER --> COREPKG
        CLIENTPKG -. packaging sidecar .- COREPKG

        SERVER --> STORAGE[(file / sqlite / postgres)]
        SERVER --> WS[Workspace registry + workspace data]

        classDef external fill:#1f6feb,stroke:#79c0ff,color:#ffffff,stroke-width:2px;
        classDef runtime fill:#238636,stroke:#56d364,color:#ffffff,stroke-width:2px;
        classDef data fill:#8957e5,stroke:#b392f0,color:#ffffff,stroke-width:2px;

        class CI,USER external;
        class SERVER,COREPKG,SERVERPKG,CLIENTPKG runtime;
        class STORAGE,WS data;
        linkStyle default stroke:#8b949e,stroke-width:2px;
```

## 2. Self-Hosted Runtime Modules

```mermaid
%%{init: {
    "theme": "base",
    "themeVariables": {
        "background": "#0d1117",
        "primaryColor": "#161b22",
        "primaryTextColor": "#e6edf3",
        "primaryBorderColor": "#3d444d",
        "secondaryColor": "#161b22",
        "secondaryTextColor": "#e6edf3",
        "secondaryBorderColor": "#3d444d",
        "tertiaryColor": "#161b22",
        "tertiaryTextColor": "#e6edf3",
        "tertiaryBorderColor": "#3d444d",
        "lineColor": "#8b949e",
        "textColor": "#e6edf3",
        "mainBkg": "#161b22",
        "clusterBkg": "#0d1117",
        "clusterBorder": "#3d444d",
        "edgeLabelBackground": "#161b22"
    }
}}%%
flowchart TD
        START[createSaasApp] --> CFG[config.ts\nresolveSaasAppConfig]
        START --> BST[storage.ts\ncreateBackendStorage]
        START --> REG[workspace-registry.ts\nWorkspaceRegistry]
        START --> AG[auth.ts\nguards + workspace resolver]
        START --> APP[app.ts\nExpress routes]

        BST --> FS[file storage]
        BST --> SQL[(sqlite storage)]
        BST --> PG[(postgres storage)]

        APP --> ADMIN[admin-ui.ts\nadmin HTML/forms]
        APP --> ING[run-ingestion.service.ts]
        APP --> APISTORE[api-store.ts]
        APP --> RDD[render-dashboard.ts]
        APP --> RTH[render-test-history.ts]

        APISTORE --> HIST[history-utils.ts]
        APISTORE --> DU[dashboard-utils.ts]
        RDD --> FMT[shared/formatting.ts]
        RDD --> I18N[shared/i18n/ru.ts]
        RTH --> FMT
        RTH --> I18N

        classDef runtime fill:#238636,stroke:#56d364,color:#ffffff,stroke-width:2px;
        classDef data fill:#8957e5,stroke:#b392f0,color:#ffffff,stroke-width:2px;
        classDef ui fill:#9e6a03,stroke:#e3b341,color:#ffffff,stroke-width:2px;
        classDef util fill:#0f766e,stroke:#5eead4,color:#ffffff,stroke-width:2px;

        class START,CFG,BST,REG,APP runtime;
        class FS,SQL,PG data;
        class ADMIN,RDD,RTH,I18N ui;
        class AG,APISTORE,HIST,DU,FMT,ING util;
        linkStyle default stroke:#8b949e,stroke-width:2px;
```

## 3. Ingestion Pipeline

```mermaid
%%{init: {
    "theme": "base",
    "themeVariables": {
        "background": "#0d1117",
        "primaryColor": "#161b22",
        "primaryTextColor": "#e6edf3",
        "primaryBorderColor": "#3d444d",
        "secondaryColor": "#161b22",
        "secondaryTextColor": "#e6edf3",
        "secondaryBorderColor": "#3d444d",
        "tertiaryColor": "#161b22",
        "tertiaryTextColor": "#e6edf3",
        "tertiaryBorderColor": "#3d444d",
        "lineColor": "#8b949e",
        "textColor": "#e6edf3",
        "mainBkg": "#161b22",
        "clusterBkg": "#0d1117",
        "clusterBorder": "#3d444d",
        "edgeLabelBackground": "#161b22"
    }
}}%%
flowchart LR
        INPUT[ReporterRoot\nfrom CI / parser / API] --> ENRICH[dashboard-utils.ts\nenrichReporterReport]
        ENRICH --> INGEST[run-ingestion.service.ts\ningestReporterRun]

        INGEST --> SUM0[buildDashboardSummary\nsummaryWithoutHistory]
        SUM0 --> ENTRY[history-utils.ts\nbuildHistoryEntryId + nextHistoryEntry]

        INGEST --> ART[materializeReportArtifacts]
        ART --> RAW[persistRawReport]
        ART --> ARCH[archiveRun]

        ENTRY --> HISTREAD[readHistory]
        HISTREAD --> APPEND[appendHistoryEntry]
        APPEND --> HISTWRITE[writeHistory]

        ARCH --> METRICS[buildAdvancedMetrics]
        METRICS --> SUM1[buildDashboardSummary\nfinal summary]
        SUM1 --> SUMMARYWRITE[writeSummary]

        SUMMARYWRITE --> OUT[workspace dist/history/archive/raw-reports/artifacts]
        HISTWRITE --> OUT
        RAW --> OUT

        classDef external fill:#1f6feb,stroke:#79c0ff,color:#ffffff,stroke-width:2px;
        classDef runtime fill:#238636,stroke:#56d364,color:#ffffff,stroke-width:2px;
        classDef data fill:#8957e5,stroke:#b392f0,color:#ffffff,stroke-width:2px;
        classDef util fill:#0f766e,stroke:#5eead4,color:#ffffff,stroke-width:2px;

        class INPUT external;
        class INGEST,SUM0,ENTRY,ART,APPEND,METRICS,SUM1 runtime;
        class RAW,ARCH,HISTREAD,HISTWRITE,SUMMARYWRITE,OUT data;
        class ENRICH util;
        linkStyle default stroke:#8b949e,stroke-width:2px;
```

## 4. Auth / Token Exchange Model

```mermaid
%%{init: {
    "theme": "base",
    "themeVariables": {
        "background": "#0d1117",
        "primaryColor": "#161b22",
        "primaryTextColor": "#e6edf3",
        "primaryBorderColor": "#3d444d",
        "secondaryColor": "#161b22",
        "secondaryTextColor": "#e6edf3",
        "secondaryBorderColor": "#3d444d",
        "tertiaryColor": "#161b22",
        "tertiaryTextColor": "#e6edf3",
        "tertiaryBorderColor": "#3d444d",
        "lineColor": "#8b949e",
        "textColor": "#e6edf3",
        "mainBkg": "#161b22",
        "clusterBkg": "#0d1117",
        "clusterBorder": "#3d444d",
        "edgeLabelBackground": "#161b22"
    }
}}%%
flowchart TD
        ADMINRAW[Admin token\nAQA_PULSE_ADMIN_TOKEN] --> ADMINLOGIN[POST /auth/admin/login]
        ADMINLOGIN --> ADMINJWT[Admin JWT / session cookie]
        ADMINJWT --> ADMINROUTES[/admin + /api/workspaces*]

        APIKEY[Workspace API key\nraw token] --> APIKEYLOGIN[POST /auth/workspaces/:slug/api-keys/login]
        APIKEYLOGIN --> INGJWT[Ingestion JWT\nscope workspace:ingest]
        INGJWT --> INGROUTE[POST /api/workspaces/:slug/ingestions]

        USERTOKEN[Workspace user token\nraw token] --> USERLOGIN[POST /auth/workspaces/:slug/users/login\nor /w/:slug/login]
        USERLOGIN --> USERJWT[Workspace JWT / session cookie\nscope workspace:read]
        USERJWT --> READROUTES[/w/:slug + /api/workspaces/:slug/*]

        ADMINJWT -. bypass read restrictions .-> READROUTES

        classDef auth fill:#da3633,stroke:#ff7b72,color:#ffffff,stroke-width:2px;
        classDef runtime fill:#238636,stroke:#56d364,color:#ffffff,stroke-width:2px;

        class ADMINRAW,ADMINJWT,APIKEY,INGJWT,USERTOKEN,USERJWT auth;
        class ADMINLOGIN,ADMINROUTES,APIKEYLOGIN,INGROUTE,USERLOGIN,READROUTES runtime;
        linkStyle default stroke:#8b949e,stroke-width:2px;
```

## 5. Dashboard / Test History Read Path

```mermaid
%%{init: {
    "theme": "base",
    "themeVariables": {
        "background": "#0d1117",
        "primaryColor": "#161b22",
        "primaryTextColor": "#e6edf3",
        "primaryBorderColor": "#3d444d",
        "secondaryColor": "#161b22",
        "secondaryTextColor": "#e6edf3",
        "secondaryBorderColor": "#3d444d",
        "tertiaryColor": "#161b22",
        "tertiaryTextColor": "#e6edf3",
        "tertiaryBorderColor": "#3d444d",
        "lineColor": "#8b949e",
        "textColor": "#e6edf3",
        "mainBkg": "#161b22",
        "clusterBkg": "#0d1117",
        "clusterBorder": "#3d444d",
        "edgeLabelBackground": "#161b22"
    }
}}%%
flowchart LR
        BROWSER[Browser] --> ROUTE[Express route in app.ts]

        ROUTE -->|dashboard| WSTORE1[backendStorage.createDashboardReadStorage\nor getWorkspaceStorage]
        ROUTE -->|test history| WSTORE2[workspace storage]

        WSTORE1 --> API1[ApiStore.getSummary / getRuns / getFilteredSummary]
        WSTORE2 --> API2[ApiStore.getTestHistory]

        API1 --> SUMREAD[summary.json + history.json + archive reads]
        API2 --> HISTREAD[history.json + archived data.json]

        API1 --> DUTIL[dashboard-utils.ts\nmetrics / normalization]
        API2 --> DUTIL
        API2 --> INCIDENT[api-store incident summary\nroot cause heuristics]

        DUTIL --> DASHHTML[render-dashboard.ts]
        INCIDENT --> TESTHTML[render-test-history.ts]
        API2 --> TESTHTML

        DASHHTML --> RESPONSE1[SSR HTML]
        TESTHTML --> RESPONSE2[SSR HTML]
        RESPONSE1 --> BROWSER
        RESPONSE2 --> BROWSER

        classDef external fill:#1f6feb,stroke:#79c0ff,color:#ffffff,stroke-width:2px;
        classDef runtime fill:#238636,stroke:#56d364,color:#ffffff,stroke-width:2px;
        classDef data fill:#8957e5,stroke:#b392f0,color:#ffffff,stroke-width:2px;
        classDef ui fill:#9e6a03,stroke:#e3b341,color:#ffffff,stroke-width:2px;
        classDef util fill:#0f766e,stroke:#5eead4,color:#ffffff,stroke-width:2px;

        class BROWSER,RESPONSE1,RESPONSE2 external;
        class ROUTE,API1,API2 runtime;
        class WSTORE1,WSTORE2,SUMREAD,HISTREAD data;
        class DASHHTML,TESTHTML ui;
        class DUTIL,INCIDENT util;
        linkStyle default stroke:#8b949e,stroke-width:2px;
```

## 6. Local CLI Parse Flow

```mermaid
%%{init: {
    "theme": "base",
    "themeVariables": {
        "background": "#0d1117",
        "primaryColor": "#161b22",
        "primaryTextColor": "#e6edf3",
        "primaryBorderColor": "#3d444d",
        "secondaryColor": "#161b22",
        "secondaryTextColor": "#e6edf3",
        "secondaryBorderColor": "#3d444d",
        "tertiaryColor": "#161b22",
        "tertiaryTextColor": "#e6edf3",
        "tertiaryBorderColor": "#3d444d",
        "lineColor": "#8b949e",
        "textColor": "#e6edf3",
        "mainBkg": "#161b22",
        "clusterBkg": "#0d1117",
        "clusterBorder": "#3d444d",
        "edgeLabelBackground": "#161b22"
    }
}}%%
flowchart LR
        CLI[parser.ts] --> LOAD[loadReporterReport]
        LOAD --> ENRICH[enrichReporterReport]
        ENRICH --> INGEST[ingestReporterRun]
        INGEST --> LOCALWS[local-cli workspace storage]
        LOCALWS --> DIST[dist/dashboard-data.json + dist/history.json]
        LOCALWS --> ARCHIVE[history/<run>/data.json]
        LOCALWS --> ART[_artifacts]

        classDef runtime fill:#238636,stroke:#56d364,color:#ffffff,stroke-width:2px;
        classDef data fill:#8957e5,stroke:#b392f0,color:#ffffff,stroke-width:2px;
        classDef util fill:#0f766e,stroke:#5eead4,color:#ffffff,stroke-width:2px;

        class CLI,INGEST runtime;
        class LOCALWS,DIST,ARCHIVE,ART data;
        class LOAD,ENRICH util;
        linkStyle default stroke:#8b949e,stroke-width:2px;
```

## 7. Helper / Utility Relationships

```mermaid
%%{init: {
    "theme": "base",
    "themeVariables": {
        "background": "#0d1117",
        "primaryColor": "#161b22",
        "primaryTextColor": "#e6edf3",
        "primaryBorderColor": "#3d444d",
        "secondaryColor": "#161b22",
        "secondaryTextColor": "#e6edf3",
        "secondaryBorderColor": "#3d444d",
        "tertiaryColor": "#161b22",
        "tertiaryTextColor": "#e6edf3",
        "tertiaryBorderColor": "#3d444d",
        "lineColor": "#8b949e",
        "textColor": "#e6edf3",
        "mainBkg": "#161b22",
        "clusterBkg": "#0d1117",
        "clusterBorder": "#3d444d",
        "edgeLabelBackground": "#161b22"
    }
}}%%
flowchart TD
        DU[dashboard-utils.ts] --> FMT[shared/formatting.ts]
        DU --> HIST[history-utils.ts]

        API[api-store.ts] --> DU
        API --> HIST

        RD[render-dashboard.ts] --> DU
        RD --> FMT
        RD --> I18N[shared/i18n/ru.ts]
        RD --> METRICINFO[render-metric-info.ts]

        RTH[render-test-history.ts] --> API
        RTH --> FMT
        RTH --> I18N
        RTH --> METRICINFO

        APP[backend/app.ts] --> API
        APP --> RD
        APP --> RTH
        APP --> AUTH[backend/auth.ts]
        APP --> REG[backend/workspace-registry.ts]

        classDef runtime fill:#238636,stroke:#56d364,color:#ffffff,stroke-width:2px;
        classDef auth fill:#da3633,stroke:#ff7b72,color:#ffffff,stroke-width:2px;
        classDef ui fill:#9e6a03,stroke:#e3b341,color:#ffffff,stroke-width:2px;
        classDef util fill:#0f766e,stroke:#5eead4,color:#ffffff,stroke-width:2px;

        class APP runtime;
        class AUTH auth;
        class RD,RTH,I18N,METRICINFO ui;
        class DU,FMT,HIST,API,REG util;
        linkStyle default stroke:#8b949e,stroke-width:2px;
```

## 8. Sequence: GitLab CI Upload -> Ingestion -> Dashboard Update

```mermaid
%%{init: {
    "theme": "base",
    "themeVariables": {
        "background": "#0d1117",
        "primaryColor": "#161b22",
        "primaryTextColor": "#e6edf3",
        "primaryBorderColor": "#3d444d",
        "secondaryColor": "#161b22",
        "secondaryTextColor": "#e6edf3",
        "secondaryBorderColor": "#3d444d",
        "tertiaryColor": "#161b22",
        "tertiaryTextColor": "#e6edf3",
        "tertiaryBorderColor": "#3d444d",
        "lineColor": "#8b949e",
        "textColor": "#e6edf3",
        "mainBkg": "#161b22",
        "noteBkgColor": "#13233a",
        "noteTextColor": "#e6edf3",
        "noteBorderColor": "#58a6ff",
        "actorBkg": "#161b22",
        "actorBorder": "#58a6ff",
        "actorTextColor": "#e6edf3",
        "actorLineColor": "#8b949e",
        "signalColor": "#8b949e",
        "signalTextColor": "#e6edf3",
        "labelBoxBkgColor": "#161b22",
        "labelBoxBorderColor": "#3d444d",
        "labelTextColor": "#e6edf3",
        "activationBkgColor": "#1f2a37",
        "activationBorderColor": "#58a6ff",
        "sequenceNumberColor": "#e6edf3"
    }
}}%%
sequenceDiagram
        participant CI as GitLab CI job
        participant PW as Playwright + data.json
        participant AUTH as /auth/workspaces/:slug/api-keys/login
        participant APP as app.ts ingestion route
        participant REG as WorkspaceRegistry
        participant ING as run-ingestion.service.ts
        participant ST as Workspace storage
        participant API as ApiStore / SSR read path

        CI->>PW: Run tests with PW_LLM_REPORT
        PW-->>CI: data.json
        CI->>AUTH: POST raw workspace API key
        AUTH->>REG: authenticate(raw API key)
        REG-->>AUTH: workspace + api key record
        AUTH-->>CI: ingestion JWT

        CI->>APP: POST /api/workspaces/:slug/ingestions\nAuthorization: Bearer ingestion JWT\npayload { report, metadata, sourceFile }
        APP->>ING: ingestReporterRun(...)
        ING->>ING: enrichReporterReport(report)
        ING->>ING: materializeReportArtifacts(...)
        ING->>ST: persistRawReport(runId, report)
        ING->>ST: readHistory()
        ING->>ST: archiveRun(report, entry)
        ING->>ST: writeHistory(history)
        ING->>ST: writeSummary(summary)
        ST-->>APP: updated workspace read-model
        APP-->>CI: 200 OK + run metadata

        Note over API,ST: Next dashboard or test-history request reads updated summary/history/archive
```

## 9. Sequence: User Login -> Workspace Read -> Test History

```mermaid
%%{init: {
    "theme": "base",
    "themeVariables": {
        "background": "#0d1117",
        "primaryColor": "#161b22",
        "primaryTextColor": "#e6edf3",
        "primaryBorderColor": "#3d444d",
        "secondaryColor": "#161b22",
        "secondaryTextColor": "#e6edf3",
        "secondaryBorderColor": "#3d444d",
        "tertiaryColor": "#161b22",
        "tertiaryTextColor": "#e6edf3",
        "tertiaryBorderColor": "#3d444d",
        "lineColor": "#8b949e",
        "textColor": "#e6edf3",
        "mainBkg": "#161b22",
        "noteBkgColor": "#13233a",
        "noteTextColor": "#e6edf3",
        "noteBorderColor": "#58a6ff",
        "actorBkg": "#161b22",
        "actorBorder": "#58a6ff",
        "actorTextColor": "#e6edf3",
        "actorLineColor": "#8b949e",
        "signalColor": "#8b949e",
        "signalTextColor": "#e6edf3",
        "labelBoxBkgColor": "#161b22",
        "labelBoxBorderColor": "#3d444d",
        "labelTextColor": "#e6edf3",
        "activationBkgColor": "#1f2a37",
        "activationBorderColor": "#58a6ff",
        "sequenceNumberColor": "#e6edf3"
    }
}}%%
sequenceDiagram
        participant U as Browser user
        participant LOGIN as /w/:slug/login
        participant USERAUTH as /auth/workspaces/:slug/users/login
        participant REG as WorkspaceRegistry
        participant DASH as /w/:slug
        participant API as ApiStore
        participant RDD as render-dashboard.ts
        participant TEST as /w/:slug/test/:name
        participant RTH as render-test-history.ts
        participant ST as Workspace storage

        U->>LOGIN: GET /w/:slug/login
        LOGIN-->>U: HTML login form

        U->>USERAUTH: POST raw workspace user token
        USERAUTH->>REG: authenticateWorkspaceUser(raw token)
        REG-->>USERAUTH: workspace + user record
        USERAUTH-->>U: workspace session cookie / JWT

        U->>DASH: GET /w/:slug
        DASH->>API: getFilteredSummary(...)
        API->>ST: read summary/history/archive as needed
        ST-->>API: workspace data
        API-->>RDD: normalized summary model
        RDD-->>DASH: SSR dashboard HTML
        DASH-->>U: dashboard page

        U->>TEST: GET /w/:slug/test/:name
        TEST->>API: getTestHistory(...)
        API->>ST: read history + archived run data
        ST-->>API: matching test history + attempts + attachments
        API-->>RTH: incident summary + diagnostics model
        RTH-->>TEST: SSR test history HTML
        TEST-->>U: test history page
```