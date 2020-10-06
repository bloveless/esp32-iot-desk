const { smarthome } = require('actions-on-google');
const mqtt = require('mqtt');
const mqtt_client = mqtt.connect(process.env.CLOUDMQTT_URL);

const model = require('./model');
const { getTokenFromHeader } = require('./util');

mqtt_client.on('connect', () => {
    console.log('Connected to mqtt');
});

const updateHeight = {
    "preset one": (deviceId) => {
        mqtt_client.publish(`/esp32_iot_desk/${deviceId}/command`, "1");
    },
    "preset two": (deviceId) => {
        mqtt_client.publish(`/esp32_iot_desk/${deviceId}/command`, "2");
    },
    "preset three": (deviceId) => {
        mqtt_client.publish(`/esp32_iot_desk/${deviceId}/command`, "3");
    },
};

const google_actions_app = smarthome({
    debug: (process.env.APP_DEBUG === "true"),
});

google_actions_app.onSync(async (body, headers) => {
    const accessToken = getTokenFromHeader(headers.authorization);
    const user = await model.getUserFromAccessToken(accessToken);
    const devices = await model.getDevicesFromUserId(user.id);

    const devicesFormatted = devices.map((device) => ({
        id: device.id,
        type: 'action.devices.types.SENSOR',
        traits: [
            'action.devices.traits.Modes'
        ],
        name: {
            defaultNames: ['My Desk'],
            name: 'ESP32 IoT Desk',
            nicknames: ['desk', 'iot desk', 'my desk']
        },
        willReportState: true,
        attributes: {
            availableModes: [{
                name: 'height',
                name_values: [{
                    name_synonym: ['preset'],
                    lang: 'en'
                }],
                settings: [{
                    setting_name: 'preset one',
                    setting_values: [{
                        setting_synonym: ['preset 1', 'one'],
                        lang: 'en'
                    }]
                }, {
                    setting_name: 'preset two',
                    setting_values: [{
                        setting_synonym: ['preset 2', 'two'],
                        lang: 'en'
                    }]
                }, {
                    setting_name: 'preset three',
                    setting_values: [{
                        setting_synonym: ['preset 3', 'three'],
                        lang: 'en'
                    }]
                }],
                ordered: true
            }]
        },
        deviceInfo: {
            manufacturer: 'Loveless Engineering',
            model: '349',
            hwVersion: '0.0.1',
            swVersion: '0.0.1'
        },
    }));

    return {
        requestId: body.requestId,
        payload: {
            agentUserId: user.id,
            devices: devicesFormatted,
        }
    };

});

google_actions_app.onQuery(async (body, headers) => {
    const accessToken = getTokenFromHeader(headers.authorization);
    const user = await model.getUserFromAccessToken(accessToken);
    const deviceIds = body.inputs.map(input => input.payload.devices.map(device => device.id)).flat();
    const devices = await model.getDevicesByUserIdAndIds(user.id, deviceIds);

    const formattedDevices = devices.reduce((accumulator, device) => {
        return {...accumulator, ...{[device.id]: { height: device.currentHeight}}};
    }, {});

    return {
        "requestId": body.requestId,
        "payload": {
            "devices": formattedDevices
        }
    };
});

google_actions_app.onExecute(async (body, headers) => {
    const accessToken = getTokenFromHeader(headers.authorization);
    const user = await model.getUserFromAccessToken(accessToken);

    // TODO: We should make sure that the devices we are getting back here are owned by the user.

    const commandResponses = [];

    body.inputs.forEach(input => {
        input.payload.commands.forEach(command => {
            const deviceIds = command.devices.map(device => device.id);
            const commandResponse = {
                ids: deviceIds,
                status: "SUCCESS",
                states: {},
            }
            command.execution.forEach(execute => {
                if (execute.command === 'action.devices.commands.SetModes' && execute.params?.updateModeSettings?.height) {
                    const newHeight = execute.params.updateModeSettings.height;
                    commandResponse.states.height = newHeight;
                    deviceIds.forEach(deviceId => {
                        if (newHeight in updateHeight) {
                            updateHeight[newHeight](deviceId);

                            model.setDeviceHeight(user.id, deviceId, newHeight);
                        }
                    });
                }
            });

            commandResponses.push(commandResponse);
        });
    });

    return {
        requestId: body.requestId,
        payload: {
            commands: commandResponses,
        },
    };
});

module.exports = { google_actions_app };
