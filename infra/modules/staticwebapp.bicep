param location string = 'westeurope'
param prefix string
param tags object
param backendFunctionAppId string
param backendRegion string

resource swa 'Microsoft.Web/staticSites@2024-04-01' = {
  name: 'swa-${prefix}'
  location: location
  tags: tags
  sku: { name: 'Standard', tier: 'Standard' }
  properties: {
    stagingEnvironmentPolicy: 'Disabled'
    allowConfigFileUpdates: true
    enterpriseGradeCdnStatus: 'Disabled'
  }
}

resource backend 'Microsoft.Web/staticSites/linkedBackends@2024-04-01' = {
  parent: swa
  name: 'func-dash'
  properties: {
    backendResourceId: backendFunctionAppId
    region: backendRegion
  }
}

output hostname string = swa.properties.defaultHostname
output name string = swa.name
