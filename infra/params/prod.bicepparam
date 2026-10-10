using '../main.bicep'

param env = 'prod'
param alertEmail = 'it@rkjh.se'
param pgAdminGroupObjectId = '<entra-group-object-id>'
param pgAdminGroupName = 'sg-rkjh-ai-dbadmins'
param dashboardBaseUrl = ''
param acsCustomDomain = ''
param mediaSshPublicKey = '<ssh-ed25519 AAAA... break-glass key>'
param twilioSignallingCidrs = ['54.171.127.192/30', '35.156.191.128/30']
param assistantName = 'ASSISTANT_NAME'
param teamsWebhookRefs = ['TEAMS_WEBHOOK_RECEPTION']
