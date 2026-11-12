/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/shin_wager.json`.
 */
export type ShinWager = {
  "address": "2exTZQktysE3gATBrRkmymsz35E5reE5ZGmtoedPhyFp",
  "metadata": {
    "name": "shinWager",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "claimFees",
      "discriminator": [
        82,
        251,
        233,
        156,
        12,
        52,
        184,
        202
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "admin",
          "writable": true,
          "signer": true,
          "relations": [
            "config"
          ]
        }
      ],
      "args": []
    },
    {
      "name": "initializeConfig",
      "discriminator": [
        208,
        127,
        21,
        1,
        194,
        190,
        196,
        70
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "wagerFeeBps",
          "type": "u16"
        },
        {
          "name": "betFeeBps",
          "type": "u16"
        }
      ]
    },
    {
      "name": "initializeMatch",
      "discriminator": [
        156,
        133,
        52,
        179,
        176,
        29,
        64,
        124
      ],
      "accounts": [
        {
          "name": "matchState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  116,
                  99,
                  104
                ]
              },
              {
                "kind": "arg",
                "path": "matchId"
              }
            ]
          }
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "player1",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "matchId",
          "type": "u64"
        },
        {
          "name": "wagerAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "joinMatch",
      "discriminator": [
        244,
        8,
        47,
        130,
        192,
        59,
        179,
        44
      ],
      "accounts": [
        {
          "name": "matchState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  116,
                  99,
                  104
                ]
              },
              {
                "kind": "arg",
                "path": "matchId"
              }
            ]
          }
        },
        {
          "name": "player2",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "matchId",
          "type": "u64"
        }
      ]
    },
    {
      "name": "placeBet",
      "discriminator": [
        222,
        62,
        67,
        220,
        63,
        166,
        126,
        33
      ],
      "accounts": [
        {
          "name": "bet",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  101,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "matchId"
              },
              {
                "kind": "account",
                "path": "spectator"
              }
            ]
          }
        },
        {
          "name": "matchState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  116,
                  99,
                  104
                ]
              },
              {
                "kind": "arg",
                "path": "matchId"
              }
            ]
          }
        },
        {
          "name": "spectator",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "matchId",
          "type": "u64"
        },
        {
          "name": "predictedWinner",
          "type": "pubkey"
        },
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "resolveMatch",
      "discriminator": [
        73,
        0,
        15,
        197,
        178,
        47,
        21,
        193
      ],
      "accounts": [
        {
          "name": "matchState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  116,
                  99,
                  104
                ]
              },
              {
                "kind": "arg",
                "path": "matchId"
              }
            ]
          }
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "oracle",
          "writable": true,
          "signer": true
        },
        {
          "name": "winnerAccount",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "matchId",
          "type": "u64"
        },
        {
          "name": "winner",
          "type": "pubkey"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "bet",
      "discriminator": [
        147,
        23,
        35,
        59,
        15,
        75,
        155,
        32
      ]
    },
    {
      "name": "config",
      "discriminator": [
        155,
        12,
        170,
        224,
        30,
        250,
        204,
        130
      ]
    },
    {
      "name": "match",
      "discriminator": [
        236,
        63,
        169,
        38,
        15,
        56,
        196,
        162
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "matchAlreadyStarted",
      "msg": "Match has already started."
    },
    {
      "code": 6001,
      "name": "matchFull",
      "msg": "Match is full."
    },
    {
      "code": 6002,
      "name": "matchNotInProgress",
      "msg": "Match is not in progress."
    },
    {
      "code": 6003,
      "name": "matchAlreadyResolved",
      "msg": "Match is already resolved."
    },
    {
      "code": 6004,
      "name": "invalidPredictedWinner",
      "msg": "Predicted winner is not a player in this match."
    },
    {
      "code": 6005,
      "name": "invalidWinner",
      "msg": "Provided winner is not a player in this match."
    },
    {
      "code": 6006,
      "name": "winnerAccountMismatch",
      "msg": "Winner account provided does not match the chosen winner."
    },
    {
      "code": 6007,
      "name": "noFeesToClaim",
      "msg": "No fees to claim."
    }
  ],
  "types": [
    {
      "name": "bet",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "matchId",
            "type": "u64"
          },
          {
            "name": "spectator",
            "type": "pubkey"
          },
          {
            "name": "predictedWinner",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "timePlaced",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "config",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "wagerFeeBps",
            "type": "u16"
          },
          {
            "name": "betFeeBps",
            "type": "u16"
          },
          {
            "name": "collectedFees",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "match",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "matchId",
            "type": "u64"
          },
          {
            "name": "player1",
            "type": "pubkey"
          },
          {
            "name": "player2",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "wagerAmount",
            "type": "u64"
          },
          {
            "name": "totalBetsP1",
            "type": "u64"
          },
          {
            "name": "totalBetsP2",
            "type": "u64"
          },
          {
            "name": "startTime",
            "type": "i64"
          },
          {
            "name": "state",
            "type": {
              "defined": {
                "name": "matchState"
              }
            }
          },
          {
            "name": "winner",
            "type": {
              "option": "pubkey"
            }
          }
        ]
      }
    },
    {
      "name": "matchState",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "waiting"
          },
          {
            "name": "inProgress"
          },
          {
            "name": "resolved"
          }
        ]
      }
    }
  ]
};
