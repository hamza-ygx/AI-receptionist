param principalId string
param keyVaultName string
param openAIName string
param acsName string = ''

var kvSecretsUser = '4633458b-17de-408a-b874-0445c86b69e6'
var openAIUser = '5e0bd9bd-7b93-4f28-af87-19fc36ad61bd'
var contributor = 'b24988ac-6180-42a0-ab88-20f7382dd24c'

resource kv 'Microsoft.KeyVault/vaults@2023-07-01' existing = { name: keyVaultName }
resource aoai 'Microsoft.CognitiveServices/accounts@2024-10-01' existing = { name: openAIName }
resource acs 'Microsoft.Communication/communicationServices@2023-04-01' existing = if (!empty(acsName)) { name: empty(acsName) ? 'none' : acsName }

resource kvRa 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(kv.id, principalId, kvSecretsUser)
  scope: kv
  properties: { roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', kvSecretsUser), principalId: principalId, principalType: 'ServicePrincipal' }
}

resource oaiRa 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(aoai.id, principalId, openAIUser)
  scope: aoai
  properties: { roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', openAIUser), principalId: principalId, principalType: 'ServicePrincipal' }
}

resource acsRa 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!empty(acsName)) {
  name: guid(acs.id, principalId, contributor)
  scope: acs
  properties: { roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', contributor), principalId: principalId, principalType: 'ServicePrincipal' }
}
