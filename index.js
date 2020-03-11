/*
* IoT Hub Philips Hue NodeJS - Microsoft Sample Code - Copyright (c) 2018 - Licensed MIT
*/
'use strict';

const Client = require('azure-iot-device').Client;
const Message = require('azure-iot-device').Message;

// DPS and connection stuff

const iotHubTransport = require('azure-iot-device-mqtt').Mqtt;

var ProvisioningTransport = require('azure-iot-provisioning-device-mqtt').Mqtt;
var SymmetricKeySecurityClient = require('azure-iot-security-symmetric-key').SymmetricKeySecurityClient;
var ProvisioningDeviceClient = require('azure-iot-provisioning-device').ProvisioningDeviceClient;

var provisioningHost = 'global.azure-devices-provisioning.net';

var request = require('request');

var client;
var config;
var connect;

var ticker;

var sendingMessage = true;

function sendUpdatedTelemetry(telemetry) {
	if (!sendingMessage) { return; }
  
	var rawMessage = JSON.stringify(telemetry);
  
	console.log("Sending:");
	console.log(rawMessage);
  
	var message = new Message(rawMessage);
  
	if (config.infoOutboundMessages)
	  console.info('Sending Telemetry Update to Azure IoT Hub');
  
	if (config.debugOutboundMessages)
	  console.debug(rawMessage);
  
	client.sendEvent(message, (err) => {
	  if (err) {
		console.error('Failed to send telemtry to Azure IoT Hub');
	  } else {
		if (config.infoOutboundMessages)
		  console.info('Telemetry successfully sent to Azure IoT Hub');
	  }
	});
}
  
function convertPayload(request) {
	if(typeof(request.payload) == "string") {
		try {
			request.payload = JSON.parse(request.payload);
		}
		catch(e) {

		}
	}
}

function getPriceForTicker(ticker,callback) {
	var self = this;

	var apiURL = "https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=" + ticker + "&apikey=" + connect.apiKey;

	var jsonContent = {};

	var requestOptions = {
		url: apiURL,
		forever: true,
		headers: {
			'Content-Type': 'application/json',
			'Accept': 'application/json',
			'Cache-Control': 'no-cache'
		}
	};

	request.get(
		requestOptions,
		function resultCallback(err, httpResponse, body) {
			if (callback) {
				if (err) {
					callback(err, null, null);
				}
				else {
					if (httpResponse.statusCode >= 400) {
						callback(new Error(httpResponse.statusMessage), null);
					}
					else {
						if (this.trace)
							console.debug(body);

						try {
							var rawResult = JSON.parse(body);
							var price = parseFloat(rawResult["Global Quote"]["05. price"]);
							var volume = parseFloat(rawResult["Global Quote"]["06. volume"]);
							console.log(ticker + ' price was ' + price + ' volume was ' + volume);
							callback(null, price, volume);
						}
						catch(eParse) {
							callback(eParse, null, null);
						}
					}
				}
			}
		}
	);
}

function onStart(request, response) {
	if (config.infoMethods)
		console.info('Try to invoke method start(' + request.payload || '' + ')');

	sendingMessage = true;

	convertPayload(request);
	
	response.send(200, 'Successully start sending message to cloud', function (err) {
		if (err) {
			console.error('[IoT hub Client] Failed sending a method response:\n' + err.message);
		}
	});
}

function onStop(request, response) {
	if (config.infoMethods)
		console.info('Try to invoke method stop(' + request.payload || '' + ')')

	sendingMessage = false;

	convertPayload(request);
	
	response.send(200, 'Successully stop sending message to cloud', function (err) {
		if (err) {
			console.error('[IoT hub Client] Failed sending a method response:\n' + err.message);
		}
	});
}

function onReceiveMessage(msg) {
	var message = msg.getData().toString('utf-8');

	client.complete(msg, () => {
		if (config.infoInboundMessages)
			console.info('Incoming Message Received');

		if (config.debugInboundMessages)
			console.debug(message);
	});
}

function checkTicker(client) {
	if (config.infoConfigurationSync)
		console.info("Syncing Device Twin...");

	client.getTwin((err, twin) => {

		if (err) {
			console.error("Get twin message error : " + err);
			return;
		}

		if (config.debugConfigurationSync) {
			console.debug("Desired:");
			console.debug(JSON.stringify(twin.properties.desired));
			console.debug("Reported:");
			console.debug(JSON.stringify(twin.properties.reported));
		}

		var twinTicker = twin.properties.desired.ticker.value;
		if(twinTicker && twinTicker != '') {
			if(twinTicker != ticker) {
				ticker = twinTicker;

				console.log("Ticker Set To " + ticker);
				
				if (config.infoConfigurationSync)
					console.info("Updating device twin...");

				// Update the device twin

				var twinUpdate = {};

				twinUpdate.ticker = ticker;

				twin.properties.reported.update(twinUpdate, function (err) {
					if (err) {
						console.error("Unable To Update Device Twin : " + err)
					}

					if (config.infoConfigurationSync)
						console.info("Device Twin Updated");
				});
			}
		}
	})

}

function initBindings() {
	// set C2D and device method callback
	client.onDeviceMethod('start', onStart);
	client.onDeviceMethod('stop', onStop);

	client.on('message', onReceiveMessage);
}

function initLogic() {
	checkTicker(client);

	setInterval(() => {
		checkTicker(client);

		if(ticker && ticker != '') {
			getPriceForTicker(ticker,function(err,price,volume) {
				if(err) {
					console.error('Unable to get stock price for ' + ticker + ' : ' + err);
				}
				else {
					var telemetry = {};
					telemetry["price"] = price;
					telemetry["volume"] = volume;

					sendUpdatedTelemetry(telemetry);
				}
			});
		}
	}, config.interval);
}

function initClient() {

	// Start the device (connect it to Azure IoT Central).
	try {
		var provisioningSecurityClient = new SymmetricKeySecurityClient(connect.deviceId, connect.symmetricKey);
		var provisioningClient = ProvisioningDeviceClient.create(provisioningHost, connect.idScope, new ProvisioningTransport(), provisioningSecurityClient);

		provisioningClient.register((err, result) => {
			if (err) {
				console.log('error registering device: ' + err);
			} else {
				console.log('registration succeeded');
				console.log('assigned hub=' + result.assignedHub);
				console.log('deviceId=' + result.deviceId);

				var connectionString = 'HostName=' + result.assignedHub + ';DeviceId=' + result.deviceId + ';SharedAccessKey=' + connect.symmetricKey;
				client = Client.fromConnectionString(connectionString, iotHubTransport);
			
				client.open((err) => {
					if (err) {
						console.error('[IoT hub Client] Connect error: ' + err.message);
						return;
					}
					else {
						console.log('[IoT hub Client] Connected Successfully');
					}

					initBindings();
					
					initLogic();
				});
			}
		});
	}
	catch(err) {
		console.log(err);
	}
}

function initDevice() {

}

// Read in configuration from config.json

try {
	config = require('./config.json');
} catch (err) {
	config = {};
	console.error('Failed to load config.json: ' + err.message);
	return;
}

// Read in connection details from connect.json

try {
	connect = require('./connect.json');
} catch (err) {
	connect = {};
	console.error('Failed to load connect.json: ' + err.message);
	return;
}

// Perform any device initialization

initDevice();


// Initialize Azure IoT Client

initClient();