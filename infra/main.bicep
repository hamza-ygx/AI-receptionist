targetScope = 'resourceGroup'

@description('Short environment name, e.g. prod or dev.')
param env string = 'prod'
param location string = 'swedencentral'
param swaLocation string = 'westeurope'
param alertEmail string

@description('Entra group (object id + display name) that administers PostgreSQL.')
param pgAdminGroupObjectId string
param pgAdminGroupName string

@description('Public dashboard URL (custom domain) or empty to use the SWA default hostname.')
param dashboardBaseUrl string = ''
param acsCustomDomain string = ''
param acsSender string = ''

param vapiBaseUrl string = 'https://api.eu.vapi.ai'
param vapiSquadId string = ''
param vapiLlmModel string = 'gpt-5.4-mini:swedencentral'
param twilioNumberE164 string = ''
param graphTenantId string = tenant().tenantId
param graphClientId string = ''
param assistantName string = 'ASSISTANT_NAME'

@description('Teams webhook app-setting names (TEAMS_WEBHOOK_*) whose values live as Key Vault secrets named the same with dashes, e.g. TEAMS_WEBHOOK_RECEPTION → teams-webhook-reception.')
param teamsWebhookRefs array = ['TEAMS_WEBHOOK_RECEPTION']

param chatDeploymentSku string = 'DataZoneStandard'
param nodeVersion string = '22'

var prefix = 'rkjh-ai-${env}'
var compact = replace(prefix, '-', '')
var tags = { app: 'rkjh-ai-receptionist', env: env, dataClass: 'personal-data', owner: 'RKJH' }

module monitoring 'modules/monitoring.bicep' = {
  name: 'monitoring'
  params: { location: location, prefix: prefix, tags: tags, alertEmail: alertEmail }
}

module network 'modules/network.bicep' = {
  name: 'network'
  params: { location: location, prefix: prefix, tags: tags }
}

module postgres 'modules/postgres.bicep' = {
  name: 'postgres'
  params: {
    location: location
    prefix: prefix
    tags: tags
    subnetId: network.outputs.postgresSubnetId
    privateDnsZoneId: network.outputs.postgresDnsZoneId
    entraAdminObjectId: pgAdminGroupObjectId
    entraAdminName: pgAdminGroupName
  }
}

module storage 'modules/storage.bicep' = {
  name: 'storage'
  params: {
    location: location
    name: take('st${compact}', 24)
    tags: tags
    allowedSubnetIds: [network.outputs.voiceSubnetId, network.outputs.dashSubnetId]
  }
}

module kv 'modules/keyvault.bicep' = {
  name: 'keyvault'
  params: { location: location, name: take('kv-${prefix}', 24), tags: tags }
}

module ai 'modules/ai.bicep' = {
  name: 'ai'
  params: { location: location, prefix: prefix, tags: tags, chatDeploymentSku: chatDeploymentSku }
}

module email 'modules/email.bicep' = {
  name: 'email'
  params: { prefix: prefix, tags: tags, customDomain: acsCustomDomain }
}

module voice 'modules/functionapp.bicep' = {
  name: 'func-voice'
  params: {
    location: location
    name: 'func-${prefix}-voice'
    tags: tags
    subnetId: network.outputs.voiceSubnetId
    storageName: storage.outputs.name
    deploymentContainer: 'deploy-func-voice'
    nodeVersion: nodeVersion
    alwaysReady: 1
  }
}

module dash 'modules/functionapp.bicep' = {
  name: 'func-dash'
  params: {
    location: location
    name: 'func-${prefix}-dash'
    tags: tags
    subnetId: network.outputs.dashSubnetId
    storageName: storage.outputs.name
    deploymentContainer: 'deploy-func-dash'
    nodeVersion: nodeVersion
    maxInstances: 10
  }
}

module swa 'modules/staticwebapp.bicep' = {
  name: 'swa'
  params: { location: swaLocation, prefix: prefix, tags: tags, backendFunctionAppId: dash.outputs.id, backendRegion: location }
}

module voiceRoles 'modules/roles.bicep' = {
  name: 'roles-voice'
  params: { principalId: voice.outputs.principalId, keyVaultName: kv.outputs.name, openAIName: ai.outputs.openAIName }
}

module dashRoles 'modules/roles.bicep' = {
  name: 'roles-dash'
  params: { principalId: dash.outputs.principalId, keyVaultName: kv.outputs.name, openAIName: ai.outputs.openAIName, acsName: 'acs-${prefix}' }
  dependsOn: [email]
}

var kvName = kv.outputs.name
func kvRef(vault string, secret string) string => '@Microsoft.KeyVault(VaultName=${vault};SecretName=${secret})'
var dashUrl = empty(dashboardBaseUrl) ? 'https://${swa.outputs.hostname}' : dashboardBaseUrl

var common = {
  PGHOST: postgres.outputs.fqdn
  PGPORT: '5432'
  PGDATABASE: 'rkjh'
  PG_ENTRA_AUTH: 'true'
  PGSSL: 'true'
  AZURE_OPENAI_ENDPOINT: ai.outputs.openAIEndpoint
  AZURE_OPENAI_EMBEDDING_DEPLOYMENT: 'text-embedding-3-small'
  AZURE_OPENAI_API_VERSION: '2024-10-21'
  DASHBOARD_BASE_URL: dashUrl
  ASSISTANT_NAME: assistantName
  RATE_LIMIT_SALT: kvRef(kvName, 'rate-limit-salt')
  RETENTION_DAYS: '30'
}

module voiceSettings 'modules/appsettings.bicep' = {
  name: 'settings-voice'
  params: {
    appName: voice.outputs.name
    storageName: storage.outputs.name
    appInsightsConnectionString: monitoring.outputs.appInsightsConnectionString
    settings: union(common, {
      APP_ROLE: 'voice'
      PGUSER: voice.outputs.name
      VAPI_BASE_URL: vapiBaseUrl
      VAPI_API_KEY: kvRef(kvName, 'vapi-api-key')
      VAPI_SQUAD_ID: vapiSquadId
      VAPI_WEBHOOK_AUTH_MODE: 'hmac'
      VAPI_WEBHOOK_SECRET: kvRef(kvName, 'vapi-webhook-secret')
      VAPI_LLM_MODEL: vapiLlmModel
      TWILIO_NUMBER_E164: twilioNumberE164
      GRAPH_TENANT_ID: graphTenantId
      GRAPH_CLIENT_ID: graphClientId
      GRAPH_CLIENT_CERT_PEM: kvRef(kvName, 'graph-client-cert-pem')
      TEAMS_FLOW_AUTH: 'entra'
      KB_ROOT_URL: 'https://rkjh.se'
    }, toObject(teamsWebhookRefs, r => r, r => kvRef(kvName, toLower(replace(r, '_', '-')))))
  }
  dependsOn: [voiceRoles]
}

module dashSettings 'modules/appsettings.bicep' = {
  name: 'settings-dash'
  params: {
    appName: dash.outputs.name
    storageName: storage.outputs.name
    appInsightsConnectionString: monitoring.outputs.appInsightsConnectionString
    settings: union(common, {
      APP_ROLE: 'dash'
      PGUSER: dash.outputs.name
      TOTP_ENC_KEY: kvRef(kvName, 'totp-enc-key')
      ACS_ENDPOINT: email.outputs.acsEndpoint
      ACS_SENDER: empty(acsSender) ? 'DoNotReply@${email.outputs.senderDomain}' : acsSender
      KB_QUEUE_URL: '${storage.outputs.queueEndpoint}kb-scrape'
    })
  }
  dependsOn: [dashRoles]
}

output voiceHostname string = voice.outputs.hostname
output dashFunctionName string = dash.outputs.name
output voiceFunctionName string = voice.outputs.name
output staticWebAppHostname string = swa.outputs.hostname
output postgresFqdn string = postgres.outputs.fqdn
output keyVaultName string = kv.outputs.name
output openAIEndpoint string = ai.outputs.openAIEndpoint
output speechResource string = ai.outputs.speechName
