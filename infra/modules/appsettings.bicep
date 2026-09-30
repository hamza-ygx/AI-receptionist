param appName string
param storageName string
param appInsightsConnectionString string
param settings object

resource app 'Microsoft.Web/sites@2024-04-01' existing = {
  name: appName
}

resource cfg 'Microsoft.Web/sites/config@2024-04-01' = {
  parent: app
  name: 'appsettings'
  properties: union({
    AzureWebJobsStorage__accountName: storageName
    AzureWebJobsStorage__credential: 'managedidentity'
    APPLICATIONINSIGHTS_CONNECTION_STRING: appInsightsConnectionString
    APPLICATIONINSIGHTS_AUTHENTICATION_STRING: 'Authorization=AAD'
  }, settings)
}
