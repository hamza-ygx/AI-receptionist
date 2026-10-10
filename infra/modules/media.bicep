param location string
param prefix string
param tags object
param subnetId string
param adminUsername string = 'rkjhadmin'
@description('SSH public key for break-glass access. No inbound SSH rule is created; use Azure Bastion or Run Command.')
param sshPublicKey string
param vmSize string = 'Standard_D4s_v5'
@description('Twilio SIP signalling CIDRs allowed to reach 5060 (check twilio.com/docs/sip-trunking/ip-addresses for your edge).')
param twilioSignallingCidrs array
@description('Twilio media CIDRs allowed to reach the RTP range.')
param twilioMediaCidrs array = ['168.86.128.0/18']

var cloudInit = '''
#cloud-config
package_update: true
packages: [ca-certificates, curl, gnupg, gettext-base, jq]
runcmd:
  - install -m 0755 -d /etc/apt/keyrings
  - curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  - echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu noble stable" > /etc/apt/sources.list.d/docker.list
  - apt-get update && apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
  - curl -sL https://aka.ms/InstallAzureCLIDeb | bash
  - systemctl enable --now docker
  - install -d -m 0750 /opt/rkjh/media
  - sysctl -w net.core.rmem_max=5000000 net.core.wmem_max=5000000
'''

resource pip 'Microsoft.Network/publicIPAddresses@2024-05-01' = {
  name: 'pip-${prefix}-media'
  location: location
  tags: tags
  sku: { name: 'Standard' }
  zones: ['1']
  properties: { publicIPAllocationMethod: 'Static', publicIPAddressVersion: 'IPv4' }
}

resource nsg 'Microsoft.Network/networkSecurityGroups@2024-05-01' = {
  name: 'nsg-${prefix}-media'
  location: location
  tags: tags
  properties: {
    securityRules: [
      {
        name: 'sip-signalling-from-twilio'
        properties: {
          priority: 100
          direction: 'Inbound'
          access: 'Allow'
          protocol: '*'
          sourceAddressPrefixes: twilioSignallingCidrs
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRanges: ['5060', '5061']
        }
      }
      {
        name: 'sip-rtp-from-twilio'
        properties: {
          priority: 110
          direction: 'Inbound'
          access: 'Allow'
          protocol: 'Udp'
          sourceAddressPrefixes: twilioMediaCidrs
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '10000-20000'
        }
      }
      {
        name: 'deny-internet-inbound'
        properties: {
          priority: 4000
          direction: 'Inbound'
          access: 'Deny'
          protocol: '*'
          sourceAddressPrefix: 'Internet'
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '*'
        }
      }
    ]
  }
}

resource nic 'Microsoft.Network/networkInterfaces@2024-05-01' = {
  name: 'nic-${prefix}-media'
  location: location
  tags: tags
  properties: {
    networkSecurityGroup: { id: nsg.id }
    ipConfigurations: [{
      name: 'ipconfig1'
      properties: {
        subnet: { id: subnetId }
        privateIPAllocationMethod: 'Dynamic'
        publicIPAddress: { id: pip.id }
      }
    }]
  }
}

resource vm 'Microsoft.Compute/virtualMachines@2024-07-01' = {
  name: 'vm-${prefix}-media'
  location: location
  tags: tags
  zones: ['1']
  identity: { type: 'SystemAssigned' }
  properties: {
    hardwareProfile: { vmSize: vmSize }
    osProfile: {
      computerName: 'rkjh-media'
      adminUsername: adminUsername
      customData: base64(cloudInit)
      linuxConfiguration: {
        disablePasswordAuthentication: true
        ssh: { publicKeys: [{ path: '/home/${adminUsername}/.ssh/authorized_keys', keyData: sshPublicKey }] }
        patchSettings: { patchMode: 'AutomaticByPlatform', assessmentMode: 'AutomaticByPlatform' }
      }
    }
    storageProfile: {
      imageReference: { publisher: 'Canonical', offer: 'ubuntu-24_04-lts', sku: 'server', version: 'latest' }
      osDisk: { createOption: 'FromImage', managedDisk: { storageAccountType: 'Premium_LRS' }, diskSizeGB: 64 }
    }
    networkProfile: { networkInterfaces: [{ id: nic.id }] }
    securityProfile: { securityType: 'TrustedLaunch', uefiSettings: { secureBootEnabled: true, vTpmEnabled: true } }
    diagnosticsProfile: { bootDiagnostics: { enabled: true } }
  }
}

output vmName string = vm.name
output principalId string = vm.identity.principalId
output publicIp string = pip.properties.ipAddress
