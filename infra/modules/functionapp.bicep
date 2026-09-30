param location string
param name string
param tags object
param subnetId string
param storageName string
param deploymentContainer string
param nodeVersion string = '22'
param alwaysReady int = 0
param maxInstances int = 40

resource sa 'Microsoft.Storage/storageAccounts@2023-05-01' existing = {
  name: storageName
}

resource plan 'Microsoft.Web/serverfarms@2024-04-01' = {
  name: 'plan-${name}'
  location: location
  tags: tags
  kind: 'functionapp'
  sku: { tier: 'FlexConsumption', name: 'FC1' }
  properties: { reserved: true }
}

resource app 'Microsoft.Web/sites@2024-04-01' = {
  name: name
  location: location
  tags: tags
  kind: 'functionapp,linux'
  identity: { type: 'SystemAssigned' }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    virtualNetworkSubnetId: subnetId
    publicNetworkAccess: 'Enabled'
    siteConfig: {
      minTlsVersion: '1.2'
      ftpsState: 'Disabled'
      http20Enabled: true
    }
    functionAppConfig: {
      deployment: {
        storage: {
          type: 'blobContainer'
          value: '${sa.properties.primaryEndpoints.blob}${deploymentContainer}'
          authentication: { type: 'SystemAssignedIdentity' }
        }
      }
      runtime: { name: 'node', version: nodeVersion }
      scaleAndConcurrency: {
        maximumInstanceCount: maxInstances
        instanceMemoryMB: 2048
        alwaysReady: alwaysReady > 0 ? [{ name: 'http', instanceCount: alwaysReady }] : []
      }
    }
  }
}

var blobOwner = 'b7e6dc6d-f1e8-4753-8033-0f276bb0955b'
var queueContributor = '974c5e8b-45b9-4653-ba55-5f855dd0fb88'
var tableContributor = '0a9a7e1f-b9d0-4cc4-a60d-0319b160aaa3'

resource ra 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for role in [blobOwner, queueContributor, tableContributor]: {
  name: guid(sa.id, app.id, role)
  scope: sa
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', role)
    principalId: app.identity.principalId
    principalType: 'ServicePrincipal'
  }
}]

output id string = app.id
output name string = app.name
output principalId string = app.identity.principalId
output hostname string = app.properties.defaultHostName
