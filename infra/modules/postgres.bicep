param location string
param prefix string
param tags object
param subnetId string
param privateDnsZoneId string
param entraAdminObjectId string
param entraAdminName string
@allowed(['User', 'Group', 'ServicePrincipal'])
param entraAdminType string = 'Group'
param skuName string = 'Standard_B1ms'
param skuTier string = 'Burstable'
param storageGb int = 32
param highAvailability bool = false

resource pg 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' = {
  name: 'psql-${prefix}'
  location: location
  tags: tags
  sku: { name: skuName, tier: skuTier }
  properties: {
    version: '16'
    storage: { storageSizeGB: storageGb, autoGrow: 'Enabled' }
    backup: { backupRetentionDays: 7, geoRedundantBackup: 'Disabled' }
    network: {
      delegatedSubnetResourceId: subnetId
      privateDnsZoneArmResourceId: privateDnsZoneId
      publicNetworkAccess: 'Disabled'
    }
    authConfig: {
      activeDirectoryAuth: 'Enabled'
      passwordAuth: 'Disabled'
      tenantId: tenant().tenantId
    }
    highAvailability: { mode: highAvailability ? 'ZoneRedundant' : 'Disabled' }
  }
}

resource admin 'Microsoft.DBforPostgreSQL/flexibleServers/administrators@2024-08-01' = {
  parent: pg
  name: entraAdminObjectId
  properties: {
    principalName: entraAdminName
    principalType: entraAdminType
    tenantId: tenant().tenantId
  }
}

resource db 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2024-08-01' = {
  parent: pg
  name: 'rkjh'
  properties: { charset: 'UTF8', collation: 'sv_SE.utf8' }
}

resource extensions 'Microsoft.DBforPostgreSQL/flexibleServers/configurations@2024-08-01' = {
  parent: pg
  name: 'azure.extensions'
  properties: { value: 'VECTOR,PG_TRGM,CITEXT,PGCRYPTO', source: 'user-override' }
  dependsOn: [admin]
}

resource tls 'Microsoft.DBforPostgreSQL/flexibleServers/configurations@2024-08-01' = {
  parent: pg
  name: 'require_secure_transport'
  properties: { value: 'ON', source: 'user-override' }
  dependsOn: [extensions]
}

resource tlsMin 'Microsoft.DBforPostgreSQL/flexibleServers/configurations@2024-08-01' = {
  parent: pg
  name: 'ssl_min_protocol_version'
  properties: { value: 'TLSv1.3', source: 'user-override' }
  dependsOn: [tls]
}

resource tz 'Microsoft.DBforPostgreSQL/flexibleServers/configurations@2024-08-01' = {
  parent: pg
  name: 'timezone'
  properties: { value: 'Europe/Stockholm', source: 'user-override' }
  dependsOn: [tlsMin]
}

output fqdn string = pg.properties.fullyQualifiedDomainName
output name string = pg.name
