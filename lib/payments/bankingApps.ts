export type BankApp = {
  id: string;
  name: string;
  shortName: string;
  color: string;
  schemes: string[];
  packageIds: string[];
  fallbackUrl: string;
  marketUrl: string;
};

export type ResolvedBankApp = BankApp & {
  detected: boolean;
};

export const SA_BANKING_APPS: BankApp[] = [
  {
    id: 'fnb',
    name: 'FNB',
    shortName: 'FNB',
    color: '#009639',
    schemes: ['fnbbanking://', 'fnb://'],
    packageIds: ['za.co.fnb.connect.itt'],
    fallbackUrl: 'https://www.fnb.co.za',
    marketUrl: 'https://play.google.com/store/apps/details?id=za.co.fnb.connect.itt',
  },
  {
    id: 'standard_bank',
    name: 'Standard Bank',
    shortName: 'SB',
    color: '#0033A0',
    schemes: ['standardbank://'],
    packageIds: ['com.standardbank.sb'],
    fallbackUrl: 'https://www.standardbank.co.za',
    marketUrl: 'https://play.google.com/store/apps/details?id=com.standardbank.sb',
  },
  {
    id: 'absa',
    name: 'ABSA',
    shortName: 'ABSA',
    color: '#E31837',
    schemes: ['absabanking://', 'absa://'],
    packageIds: ['com.barclays.africa'],
    fallbackUrl: 'https://www.absa.co.za',
    marketUrl: 'https://play.google.com/store/apps/details?id=com.barclays.africa',
  },
  {
    id: 'nedbank',
    name: 'Nedbank',
    shortName: 'NED',
    color: '#007A4E',
    schemes: ['nedbankmoneyapp://', 'nedbank://'],
    packageIds: ['za.co.nedbank.nedbank'],
    fallbackUrl: 'https://www.nedbank.co.za',
    marketUrl: 'https://play.google.com/store/apps/details?id=za.co.nedbank.nedbank',
  },
  {
    id: 'capitec',
    name: 'Capitec',
    shortName: 'CAP',
    color: '#E5173F',
    schemes: ['capitecbank://', 'capitec://'],
    packageIds: ['za.co.capitecbank.production', 'za.co.capitecbank'],
    fallbackUrl: 'https://www.capitecbank.co.za',
    marketUrl: 'https://play.google.com/store/apps/details?id=za.co.capitecbank.production',
  },
  {
    id: 'tymebank',
    name: 'TymeBank',
    shortName: 'TYME',
    color: '#FF4B00',
    schemes: ['tymebank://'],
    packageIds: ['za.co.tymebank', 'za.co.tymebank.digital'],
    fallbackUrl: 'https://www.tymebank.co.za',
    marketUrl: 'https://play.google.com/store/apps/details?id=za.co.tymebank',
  },
  {
    id: 'discovery',
    name: 'Discovery Bank',
    shortName: 'DISC',
    color: '#003366',
    schemes: ['discoverybank://', 'discovery://'],
    packageIds: ['com.discoverycoza', 'com.discovery.bank'],
    fallbackUrl: 'https://www.discovery.co.za/bank',
    marketUrl: 'https://play.google.com/store/apps/details?id=com.discoverycoza',
  },
  {
    id: 'investec',
    name: 'Investec',
    shortName: 'INV',
    color: '#00205B',
    schemes: ['investec://'],
    packageIds: ['za.co.investec'],
    fallbackUrl: 'https://www.investec.com',
    marketUrl: 'https://play.google.com/store/apps/details?id=za.co.investec',
  },
  {
    id: 'african_bank',
    name: 'African Bank',
    shortName: 'AFB',
    color: '#00A651',
    schemes: ['africanbank://'],
    packageIds: ['za.co.africanbank.application', 'za.co.africanbank.myworld'],
    fallbackUrl: 'https://www.africanbank.co.za',
    marketUrl: 'https://play.google.com/store/apps/details?id=za.co.africanbank.application',
  },
];
