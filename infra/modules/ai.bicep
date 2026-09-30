param location string
param prefix string
param tags object
param chatModelName string = 'gpt-5.4-mini'
param chatModelVersion string = '2026-03-17'
@allowed(['DataZoneStandard', 'Standard'])
param chatDeploymentSku string = 'DataZoneStandard'
param chatCapacityK int = 100
param embeddingModelName string = 'text-embedding-3-small'
param embeddingModelVersion string = '1'
param embeddingCapacityK int = 50

resource aoai 'Microsoft.CognitiveServices/accounts@2024-10-01' = {
  name: 'oai-${prefix}'
  location: location
  tags: tags
  kind: 'OpenAI'
  sku: { name: 'S0' }
  properties: {
    customSubDomainName: 'oai-${prefix}'
    publicNetworkAccess: 'Enabled'
    disableLocalAuth: false
    restrictOutboundNetworkAccess: true
    allowedFqdnList: []
  }
}

resource chat 'Microsoft.CognitiveServices/accounts/deployments@2024-10-01' = {
  parent: aoai
  name: chatModelName
  sku: { name: chatDeploymentSku, capacity: chatCapacityK }
  properties: {
    model: { format: 'OpenAI', name: chatModelName, version: chatModelVersion }
    versionUpgradeOption: 'NoAutoUpgrade'
    raiPolicyName: 'Microsoft.DefaultV2'
  }
}

resource embedding 'Microsoft.CognitiveServices/accounts/deployments@2024-10-01' = {
  parent: aoai
  name: embeddingModelName
  sku: { name: 'Standard', capacity: embeddingCapacityK }
  properties: {
    model: { format: 'OpenAI', name: embeddingModelName, version: embeddingModelVersion }
    versionUpgradeOption: 'OnceNewDefaultVersionAvailable'
  }
  dependsOn: [chat]
}

resource speech 'Microsoft.CognitiveServices/accounts@2024-10-01' = {
  name: 'spch-${prefix}'
  location: location
  tags: tags
  kind: 'SpeechServices'
  sku: { name: 'S0' }
  properties: {
    customSubDomainName: 'spch-${prefix}'
    publicNetworkAccess: 'Enabled'
    disableLocalAuth: false
  }
}

output openAIId string = aoai.id
output openAIName string = aoai.name
output openAIEndpoint string = aoai.properties.endpoint
output speechId string = speech.id
output speechName string = speech.name
