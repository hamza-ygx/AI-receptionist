param location string
param prefix string
param tags object
param addressSpace string = '10.40.0.0/22'

var delegationFlex = [{ name: 'flex', properties: { serviceName: 'Microsoft.App/environments' } }]

resource vnet 'Microsoft.Network/virtualNetworks@2024-05-01' = {
  name: 'vnet-${prefix}'
  location: location
  tags: tags
  properties: {
    addressSpace: { addressPrefixes: [addressSpace] }
    subnets: [
      {
        name: 'snet-func-voice'
        properties: {
          addressPrefix: cidrSubnet(addressSpace, 26, 0)
          delegations: delegationFlex
          serviceEndpoints: [{ service: 'Microsoft.Storage' }, { service: 'Microsoft.KeyVault' }, { service: 'Microsoft.CognitiveServices' }]
        }
      }
      {
        name: 'snet-func-dash'
        properties: {
          addressPrefix: cidrSubnet(addressSpace, 26, 1)
          delegations: delegationFlex
          serviceEndpoints: [{ service: 'Microsoft.Storage' }, { service: 'Microsoft.KeyVault' }, { service: 'Microsoft.CognitiveServices' }]
        }
      }
      {
        name: 'snet-postgres'
        properties: {
          addressPrefix: cidrSubnet(addressSpace, 26, 2)
          delegations: [{ name: 'pg', properties: { serviceName: 'Microsoft.DBforPostgreSQL/flexibleServers' } }]
        }
      }
      {
        name: 'snet-admin'
        properties: {
          addressPrefix: cidrSubnet(addressSpace, 26, 3)
        }
      }
    ]
  }
}

resource pgDns 'Microsoft.Network/privateDnsZones@2024-06-01' = {
  name: '${prefix}.private.postgres.database.azure.com'
  location: 'global'
  tags: tags
}

resource pgDnsLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2024-06-01' = {
  parent: pgDns
  name: 'link-${prefix}'
  location: 'global'
  properties: {
    registrationEnabled: false
    virtualNetwork: { id: vnet.id }
  }
}

output vnetId string = vnet.id
output voiceSubnetId string = vnet.properties.subnets[0].id
output dashSubnetId string = vnet.properties.subnets[1].id
output postgresSubnetId string = vnet.properties.subnets[2].id
output adminSubnetId string = vnet.properties.subnets[3].id
output postgresDnsZoneId string = pgDns.id
