---
services: iot-hub, iot-central
platforms: Nodejs
author: rickb
---

# Azure IoT Hub/IoT Central Stock Price Interface

This utilizes the Azure IoT Node.js SDK to connect to a stock price API and will send price data as telemetry to Azure IoT.

# How To Configure This Device Connector

In a connect.json file, you'll need to provide the idScope, deviceId, and connection key that are displayed when you select "Connect" from the device view inside of IoT Central

{
    "idScope" : "0ne00000000",
    "deviceId" : "MyPiface",
    "symmetricKey" : "z11uz4E35gO0Z9uI0PYcVm/twUyAm/iJovuMk8A2xpo=",
}

In the connect.json file, you'll also need to provide an free API key for the AlphaVantage stock price service.  This can be obtained via the following link: https://www.alphavantage.co/support/#api-key.  

  "apiKey" : "<YourAPIKey>"

In the config.json file, you specify the interval in milliseconds to specify how frequently stock price/telemetry values will be sent to Azure IoT.

  "interval": 60000

On the server side, in IoT Central, configure a "setting" with the property name "ticker", which corresponds to the ticker symbol for the stock to be monitored.  When this connector starts up, it will request that information from Azure IoT.

# How To Run This Device Connector 

Launch index.js to execute this connector.

# Features

This connector allows you to acquire stock price information for a specific ticker and send that information to Azure IoT Central for display, rules, and analysis.  It will send price and volume, though it could easily be modified/enhanced to send more data.



