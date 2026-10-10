param location string
param name string
param tags object
param pullPrincipalIds array

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: name
  location: location
  tags: tags
  sku: { name: 'Basic' }
  properties: { adminUserEnabled: false, publicNetworkAccess: 'Enabled' }
}

var acrPull = '7f951dda-4ed3-4680-a7ca-43fe172d538d'

resource pull 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for id in pullPrincipalIds: {
  name: guid(acr.id, id, acrPull)
  scope: acr
  properties: { roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPull), principalId: id, principalType: 'ServicePrincipal' }
}]

output name string = acr.name
output loginServer string = acr.properties.loginServer
