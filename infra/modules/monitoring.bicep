param location string
param prefix string
param tags object
param alertEmail string

resource law 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: 'log-${prefix}'
  location: location
  tags: tags
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
    features: { enableLogAccessUsingOnlyResourcePermissions: true }
  }
}

resource appi 'Microsoft.Insights/components@2020-02-02' = {
  name: 'appi-${prefix}'
  location: location
  tags: tags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: law.id
    RetentionInDays: 30
    DisableIpMasking: false
    IngestionMode: 'LogAnalytics'
  }
}

resource ag 'Microsoft.Insights/actionGroups@2023-01-01' = {
  name: 'ag-${prefix}'
  location: 'global'
  tags: tags
  properties: {
    groupShortName: 'rkjh-ai'
    enabled: true
    emailReceivers: [{ name: 'ops', emailAddress: alertEmail, useCommonAlertSchema: true }]
  }
}

resource deletionAlert 'Microsoft.Insights/scheduledQueryRules@2023-12-01' = {
  name: 'alert-${prefix}-vapi-deletion'
  location: location
  tags: tags
  properties: {
    displayName: 'Vapi call deletion unconfirmed > 24h'
    severity: 2
    enabled: true
    scopes: [appi.id]
    evaluationFrequency: 'PT1H'
    windowSize: 'P1D'
    criteria: {
      allOf: [{
        query: 'traces | where message startswith "ALERT: Vapi call deletions unconfirmed"'
        timeAggregation: 'Count'
        operator: 'GreaterThan'
        threshold: 0
        failingPeriods: { numberOfEvaluationPeriods: 1, minFailingPeriodsToAlert: 1 }
      }]
    }
    actions: { actionGroups: [ag.id] }
  }
}

resource errorAlert 'Microsoft.Insights/scheduledQueryRules@2023-12-01' = {
  name: 'alert-${prefix}-errors'
  location: location
  tags: tags
  properties: {
    displayName: 'Receptionist backend errors'
    severity: 2
    enabled: true
    scopes: [appi.id]
    evaluationFrequency: 'PT15M'
    windowSize: 'PT15M'
    criteria: {
      allOf: [{
        query: 'union exceptions, (traces | where severityLevel >= 3) | where cloud_RoleName startswith "func-"'
        timeAggregation: 'Count'
        operator: 'GreaterThan'
        threshold: 5
        failingPeriods: { numberOfEvaluationPeriods: 1, minFailingPeriodsToAlert: 1 }
      }]
    }
    actions: { actionGroups: [ag.id] }
  }
}

output appInsightsConnectionString string = appi.properties.ConnectionString
output workspaceId string = law.id
