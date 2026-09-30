param prefix string
param tags object
param customDomain string = ''

resource email 'Microsoft.Communication/emailServices@2023-04-01' = {
  name: 'ecs-${prefix}'
  location: 'global'
  tags: tags
  properties: { dataLocation: 'Europe' }
}

resource azureDomain 'Microsoft.Communication/emailServices/domains@2023-04-01' = if (empty(customDomain)) {
  parent: email
  name: 'AzureManagedDomain'
  location: 'global'
  properties: { domainManagement: 'AzureManaged', userEngagementTracking: 'Disabled' }
}

resource customDom 'Microsoft.Communication/emailServices/domains@2023-04-01' = if (!empty(customDomain)) {
  parent: email
  name: empty(customDomain) ? 'placeholder' : customDomain
  location: 'global'
  properties: { domainManagement: 'CustomerManaged', userEngagementTracking: 'Disabled' }
}

resource acs 'Microsoft.Communication/communicationServices@2023-04-01' = {
  name: 'acs-${prefix}'
  location: 'global'
  tags: tags
  properties: {
    dataLocation: 'Europe'
    linkedDomains: empty(customDomain) ? [azureDomain.id] : []
  }
}

output acsId string = acs.id
output acsEndpoint string = 'https://${acs.properties.hostName}'
output senderDomain string = empty(customDomain) ? azureDomain!.properties.mailFromSenderDomain : customDomain
