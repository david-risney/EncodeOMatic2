export const DEFAULT_SESSION_NAME = 'x509-certificate-inspection';

export const DEFAULT_SESSION = {
  pipes: [
    {
      id: 'certificate-base64',
      type: 'InputPipe',
      configs: {
        text: 'MIIDZzCCAk+gAwIBAgIUQTdkmbglQ265UROnP5cgcAFE+GAwDQYJKoZIhvcNAQELBQAwQzEZMBcGA1UEAwwQYXBpLmV4YW1wbGUudGVzdDEZMBcGA1UECgwQRXhhbXBsZSBTZXJ2aWNlczELMAkGA1UEBhMCVVMwHhcNMjYwODAxMTkxMTQzWhcNMzYwNzI5MTkxMTQzWjBDMRkwFwYDVQQDDBBhcGkuZXhhbXBsZS50ZXN0MRkwFwYDVQQKDBBFeGFtcGxlIFNlcnZpY2VzMQswCQYDVQQGEwJVUzCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBALks1oZSjvmAvhZCPLOAFIIelE09axhWYWAVnl1I3K6pTYPE15G35Cu0YybBb1FfV7Ux7LFMwKpTmRWbOwnjRWNKWd8/ZXm9578kArPk9NZwiMukfCGKyZe1nyRNC447Xa1J5K+GeZJUUHg0gbkYR5IGHjnKoWIbN7nOEqG//zpvUHz+R2ceh0OTdxjrUq5gWkQTkUeP2Kk/ufB5OQt5swltmBLneU39+bWQCVK+daSrtOmNvViXrBn5I/ATmRhhJBe3ys1GIoD243CxCWXEZmgVzDdRb0qYf1ZfeykoUKVteGRzdpVaSzRuUpC6JBHdfC7GkZNwlVi4powR+yzjt08CAwEAAaNTMFEwHQYDVR0OBBYEFAmUFve5qmB8J8ZztJ5M9sc1b15WMB8GA1UdIwQYMBaAFAmUFve5qmB8J8ZztJ5M9sc1b15WMA8GA1UdEwEB/wQFMAMBAf8wDQYJKoZIhvcNAQELBQADggEBACQadj8ULObLqR2mZ522pXxQiXY0cI/i97Yx8jkYG/bYeV+IgKvPRjyztj8ek/moSVrDRm05gtmE4WL/R6rqbASo4gaeoOK/ZnCRCo3c2BCyTRWysQbmzfcleZ3jX1B86b5xJlZ9YgQcED+5ODfEM+3Vl2K83AmQyJ90Kn9skBHTbR1IvL/onrSvfps/ss/+fteR+wOS7lAqIxlh3Z8n3QzS+UThBRNfcVoor6axkU1SPUQbohsC8Bn6X2coF+uV/5Hb7hF2SYWR/4KLruXe+5SJg3I1QclGkrwM7SDV5bZM4htCm2Cb36ktg9MlWbXwOP8ivkmq2piZ2ygh3x4TaJE=',
      },
      position: { x: 80, y: 180 },
    },
    {
      id: 'decode-certificate',
      type: 'Base64Decode',
      configs: {},
      position: { x: 390, y: 180 },
    },
    {
      id: 'parse-certificate',
      type: 'Asn1Parser',
      configs: {},
      position: { x: 700, y: 180 },
    },
  ],
  connections: [
    {
      fromPipeId: 'certificate-base64',
      fromOutput: 'output',
      toPipeId: 'decode-certificate',
      toInput: 'input',
    },
    {
      fromPipeId: 'decode-certificate',
      fromOutput: 'output',
      toPipeId: 'parse-certificate',
      toInput: 'input',
    },
  ],
};
