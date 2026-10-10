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

@description('SSH public key for break-glass access to the media VM (no inbound SSH rule is opened).')
param mediaSshPublicKey string
param mediaVmSize string = 'Standard_D4s_v5'
@description('Twilio SIP signalling CIDRs for your edge (IE1 Dublin / DE1 Frankfurt). Verify at twilio.com/docs/sip-trunking/ip-addresses.')
param twilioSignallingCidrs array
param twilioMediaCidrs array = ['168.86.128.0/18']
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
    allowedSubnetIds: [network.outputs.jobsSubnetId, network.outputs.dashSubnetId]
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

module jobs 'modules/functionapp.bicep' = {
  name: 'func-jobs'
  params: {
    location: location
    name: 'func-${prefix}-jobs'
    tags: tags
    subnetId: network.outputs.jobsSubnetId
    storageName: storage.outputs.name
    deploymentContainer: 'deploy-func-jobs'
    nodeVersion: nodeVersion
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

module jobsRoles 'modules/roles.bicep' = {
  name: 'roles-jobs'
  params: { principalId: jobs.outputs.principalId, keyVaultName: kv.outputs.name, openAIName: ai.outputs.openAIName }
}

module media 'modules/media.bicep' = {
  name: 'media'
  params: {
    location: location
    prefix: prefix
    tags: tags
    subnetId: network.outputs.mediaSubnetId
    sshPublicKey: mediaSshPublicKey
    vmSize: mediaVmSize
    twilioSignallingCidrs: twilioSignallingCidrs
    twilioMediaCidrs: twilioMediaCidrs
  }
}

module mediaRoles 'modules/roles.bicep' = {
  name: 'roles-media'
  params: { principalId: media.outputs.principalId, keyVaultName: kv.outputs.name, openAIName: ai.outputs.openAIName }
}

module acr 'modules/acr.bicep' = {
  name: 'acr'
  params: { location: location, name: take('acr${compact}', 50), tags: tags, pullPrincipalIds: [media.outputs.principalId] }
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
  AZURE_OPENAI_CHAT_DEPLOYMENT: 'gpt-5.4-mini'
  DASHBOARD_BASE_URL: dashUrl
  ASSISTANT_NAME: assistantName
  RATE_LIMIT_SALT: kvRef(kvName, 'rate-limit-salt')
  RETENTION_DAYS: '30'
}

module jobsSettings 'modules/appsettings.bicep' = {
  name: 'settings-jobs'
  params: {
    appName: jobs.outputs.name
    storageName: storage.outputs.name
    appInsightsConnectionString: monitoring.outputs.appInsightsConnectionString
    settings: union(common, {
      APP_ROLE: 'jobs'
      PGUSER: jobs.outputs.name
      TEAMS_FLOW_AUTH: 'entra'
      KB_ROOT_URL: 'https://rkjh.se'
    }, toObject(teamsWebhookRefs, r => r, r => kvRef(kvName, toLower(replace(r, '_', '-')))))
  }
  dependsOn: [jobsRoles]
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

output jobsHostname string = jobs.outputs.hostname
output dashFunctionName string = dash.outputs.name
output jobsFunctionName string = jobs.outputs.name
output mediaVmName string = media.outputs.vmName
output mediaPublicIp string = media.outputs.publicIp
output acrName string = acr.outputs.name
output staticWebAppHostname string = swa.outputs.hostname
output postgresFqdn string = postgres.outputs.fqdn
output keyVaultName string = kv.outputs.name
output openAIEndpoint string = ai.outputs.openAIEndpoint
output speechResource string = ai.outputs.speechName
