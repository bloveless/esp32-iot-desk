/**
 * Module dependencies.
 */

const { Pool } = require("pg");
const crypto = require("crypto");
const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

module.exports.getAccessToken = (bearerToken) => {
    return pool.query(
        `
            SELECT
                 access_token
                ,access_token_expires_at
                ,client_id
                ,refresh_token
                ,refresh_token_expires_at
                ,user_id
            FROM oauth_tokens
            WHERE access_token = $1
                AND revoked = false;
        `,
        [bearerToken]
    ).then(function (result) {
        const token = result.rows[0];

        return {
            accessToken: token.access_token,
            accessTokenExpiresAt: token.access_token_expires_at,
            client: { id: token.client_id },
            user: { id: token.user_id }, // could be any object
        };
    });
};

module.exports.getClient = (clientId, clientSecret) => {
    let query = `
        SELECT
             client_id
            ,client_secret
            ,redirect_uri
        FROM oauth_clients
        WHERE client_id = $1
          AND client_secret = $2;
    `;
    let queryArgs = [clientId, clientSecret];
    if (!clientSecret) {
        query = `
            SELECT
                 client_id
                ,client_secret
                ,redirect_uri
            FROM oauth_clients
            WHERE client_id = $1;
        `;
        queryArgs = [clientId];
    }

    return pool.query(query, queryArgs)
        .then(function (result) {
            const oAuthClient = result.rows[0];

            if (!oAuthClient) {
                return;
            }

            return {
                id: oAuthClient.client_id,
                grants: ["password", "authorization_code", "refresh_token"],
                redirectUris: [oAuthClient.redirect_uri],
            };
        });
};

module.exports.getRefreshToken = (bearerToken) => {
    return pool.query(
        `
            SELECT
                 ot.access_token
                ,ot.access_token_expires_at
                ,c.client_id
                ,c.redirect_uri
                ,ot.refresh_token
                ,ot.refresh_token_expires_at
                ,u.id as user_id
                ,u.email as user_email
            FROM oauth_tokens ot
            INNER JOIN users u
                ON u.id = ot.user_id
            INNER JOIN oauth_clients c
                on c.client_id = ot.client_id
            WHERE refresh_token = $1
                AND revoked = false;
        `,
        [bearerToken]
    ).then(function (result) {
        if (result.rowCount) {
            const row = result.rows[0];

            return {
                accessToken: row.access_token,
                accessTokenExpiresAt: row.access_token_expires_at,
                refreshToken: row.refresh_token,
                refreshTokenExpiresAt: row.refresh_token_expires_at,
                client: {
                    id: row.client_id,
                    redirectUri: row.redirect_uri,
                },
                user: {
                    id: row.user_id,
                    email: row.email,
                },
            };
        }

        return false;
    });
};

module.exports.getUser = (email, password) => {
    const hashedPassword = crypto.createHash("sha256").update(password).digest("hex");
    return pool.query(
        `
            SELECT
                 id
                ,email
            FROM users
            WHERE email = $1
            AND password = $2;
        `,
        [email, hashedPassword]
    ).then((result) => result.rowCount ? result.rows[0] : false);
};

module.exports.getUserFromAccessToken = (token) => {
    return pool.query(
        `
            SELECT
                 u.id
                ,u.email
            FROM users u
            INNER JOIN oauth_tokens ot
                ON ot.user_id = u.id
            WHERE ot.access_token = $1
                AND ot.revoked = false;
        `,
        [token]
    ).then((result) => {
        if (result.rowCount) {
            const row = result.rows[0];

            return {
                id: row.id,
                email: row.email,
            };
        }

        return false;
    });
};

module.exports.getDevicesFromUserId = (userId) => {
    return pool.query(
        `
            SELECT
                 id
                ,user_id
            FROM devices
            WHERE user_id = $1;
        `,
        [userId]
    ).then((results) => {
        if (results.rowCount) {
            return results.rows.map((row) => ({
                id: row.id,
                userId: row.user_id,
            }));
        }

        return [];
    })
};

module.exports.getDevicesByUserIdAndIds = (userId, deviceIds) => {
    return pool.query(
        `
            SELECT
                 id
                ,user_id
            FROM devices
            WHERE user_id = $1
                AND devices.id = ANY ($2);
        `,
        [userId, deviceIds]
    ).then((results) => {
        if (results.rowCount) {
            return results.rows.map((row) => ({
                id: row.id,
                userId: row.user_id,
            }));
        }

        return [];
    })
};

module.exports.createUser = (email, password) => {
    const hashedPassword = crypto.createHash("sha256").update(password).digest("hex");
    return pool.query(
        `
            INSERT INTO users(
                 id
                ,email
                ,password
            ) VALUES (
                uuid_generate_v1(),
                $1,
                $2
            )
            RETURNING
                 id
                ,email;
        `,
        [email, hashedPassword]
    ).then(function (result) {
        return result.rowCount ? result.rows[0] : false;
    });
}

module.exports.saveToken = (token, client, user) => {
    return pool.query(
            `
            INSERT INTO oauth_tokens(
                 id
                ,access_token
                ,access_token_expires_at
                ,client_id
                ,refresh_token
                ,refresh_token_expires_at
                ,user_id
            ) VALUES (
                 uuid_generate_v1()
                ,$1
                ,$2
                ,$3
                ,$4
                ,$5
                ,$6
            )
            RETURNING
                 access_token
                ,access_token_expires_at
                ,client_id
                ,refresh_token
                ,refresh_token_expires_at
                ,user_id;
        `,
        [
            token.accessToken,
            token.accessTokenExpiresAt,
            client.id,
            token.refreshToken,
            token.refreshTokenExpiresAt,
            user.id,
        ]
    ).then(function (result) {
        if (result.rowCount) {
            const row = result.rows[0];

            return {
                accessToken: row.access_token,
                accessTokenExpiresAt: row.access_token_expires_at,
                client: {
                    id: row.client_id,
                },
                refreshToken: row.refresh_token,
                refreshTokenExpiresAt: row.refresh_token_expires_at,
                user: {
                    id: row.user_id,
                },
            }
        }

        return false;
    });
};

module.exports.saveAuthorizationCode = (code, client, user) => {
    return pool.query(
            `
            INSERT INTO oauth_authorization_codes(
                 id
                ,authorization_code
                ,expires_at
                ,client_id
                ,user_id
            ) VALUES (
                uuid_generate_v1(),
                $1,
                $2,
                $3,
                $4
            );
        `,
        [
            code.authorizationCode,
            code.expiresAt,
            client.id,
            user.id
        ]
    ).then(() => {
        return code;
    });
}

module.exports.getAuthorizationCode = (code) => {
    return pool.query(
            `
            SELECT
                 oac.id as id
                ,oac.authorization_code as authorization_code
                ,oc.client_id as client_id
                ,u.id as user_id
                ,u.email as user_email
                ,oac.expires_at as expires_at
                ,oc.redirect_uri as redirect_uri
            FROM oauth_authorization_codes oac
            INNER JOIN users u
                ON oac.user_id = u.id
            INNER JOIN oauth_clients oc
                ON oac.client_id = oc.client_id
            WHERE oac.authorization_code = $1
                AND oac.revoked = false;
        `,
        [code]
    ).then((results) => {
        if (results.rowCount > 0) {
            const row = results.rows[0];

            return {
                id: row.id,
                authorizationCode: row.authorization_code,
                scope: "",
                client: {
                    id: row.client_id,
                },
                user: {
                    id: row.user_id,
                    email: row.user_email,
                },
                expiresAt: row.expires_at,
                redirectUri: row.redirect_uri,
            }
        }

        return false;
    });
}

module.exports.revokeAuthorizationCode = (code) => {
    return pool.query(
        `
            UPDATE oauth_authorization_codes
                SET revoked = true
            WHERE id = $1
                AND revoked = false;
        `,
        [code.id]
    ).then(() => {
        return true;
    });
}

module.exports.revokeToken = (code) => {
    return pool.query(
        `
            UPDATE oauth_tokens
                SET revoked = true
            WHERE refresh_token = $1;
        `,
        [code.refreshToken]
    ).then(() => {
        return true;
    });
}
