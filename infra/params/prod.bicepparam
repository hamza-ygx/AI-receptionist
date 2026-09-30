using '../main.bicep'

param env = 'prod'
param alertEmail = 'it@rkjh.se'
param pgAdminGroupObjectId = '<entra-group-object-id>'
param pgAdminGroupName = 'sg-rkjh-ai-dbadmins'
param dashboardBaseUrl = ''
param acsCustomDomain = ''
param vapiSquadId = '<from vapi/state.prod.json>'
param twilioNumberE164 = '+4610xxxxxxx'
param graphClientId = '<app-registration-client-id>'
param assistantName = 'ASSISTANT_NAME'
param teamsWebhookRefs = ['TEAMS_WEBHOOK_RECEPTION']
