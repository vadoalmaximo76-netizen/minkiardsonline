import React, { useEffect } from 'react';

interface CardAnimationProps {
  isVisible: boolean;
  cardName: string;
  onComplete: () => void;
}

export const CardAnimation: React.FC<CardAnimationProps> = ({
  isVisible,
  cardName,
  onComplete
}) => {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(onComplete, 3000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onComplete]);

  if (!isVisible) return null;

  const getAnimation = () => {
    const normalizedName = cardName.toUpperCase().trim();

    switch (normalizedName) {
      case 'BAMBOLA VOODOO':
      case 'BAMBOLA-VOODOO':
        return (
          <div className="animate-in zoom-in-50 fade-in duration-500">
            <div className="relative">
              {/* Mystical circle */}
              <div className="w-64 h-64 rounded-full border-4 border-purple-500 animate-spin" style={{ animationDuration: '3s' }}>
                <div className="absolute inset-0 rounded-full border-4 border-pink-500 animate-spin" style={{ animationDuration: '2s', animationDirection: 'reverse' }} />
              </div>
              {/* Voodoo symbols */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-9xl animate-pulse">🔮</div>
              </div>
              {/* Magical particles */}
              {[...Array(12)].map((_, i) => (
                <div
                  key={i}
                  className="absolute w-4 h-4 bg-purple-400 rounded-full animate-ping"
                  style={{
                    left: `${50 + 40 * Math.cos((i * Math.PI) / 6)}%`,
                    top: `${50 + 40 * Math.sin((i * Math.PI) / 6)}%`,
                    animationDelay: `${i * 0.1}s`
                  }}
                />
              ))}
            </div>
          </div>
        );

      case 'UNA TEMPESTA BABY':
        return (
          <div className="relative w-96 h-96">
            {/* Storm clouds */}
            <div className="absolute inset-0 bg-gradient-to-b from-gray-800 to-gray-600 opacity-80 rounded-full animate-pulse" />
            {/* Lightning bolts */}
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="absolute w-1 h-32 bg-yellow-300 animate-pulse"
                style={{
                  left: `${20 + i * 10}%`,
                  top: `${10 + (i % 3) * 20}%`,
                  animationDelay: `${i * 0.2}s`,
                  transform: `rotate(${10 + i * 5}deg)`,
                  boxShadow: '0 0 20px yellow'
                }}
              />
            ))}
            {/* Rain */}
            {[...Array(50)].map((_, i) => (
              <div
                key={`rain-${i}`}
                className="absolute w-0.5 h-8 bg-blue-300 opacity-60"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `-10%`,
                  animation: `rain-fall ${0.5 + Math.random() * 0.5}s linear infinite`,
                  animationDelay: `${Math.random() * 2}s`
                }}
              />
            ))}
            <div className="absolute inset-0 flex items-center justify-center text-9xl animate-pulse">⛈️</div>
          </div>
        );

      case 'ACCETTATA':
        return (
          <div className="relative w-96 h-96">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-9xl animate-in slide-in-from-top-48 duration-700" style={{ animation: 'axe-swing 0.7s ease-out' }}>
                🪓
              </div>
            </div>
            {/* Slash effect */}
            <div className="absolute inset-0 bg-red-500 opacity-30 animate-pulse" style={{ clipPath: 'polygon(10% 0%, 90% 0%, 70% 100%, 30% 100%)' }} />
          </div>
        );

      case 'ACCHIAPPT CHESSA':
        return (
          <div className="relative w-96 h-96">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-9xl animate-bounce">🔥</div>
            </div>
            {/* Giant flame waves */}
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="absolute inset-0 rounded-full border-8 border-orange-500 opacity-70 animate-ping"
                style={{
                  animationDelay: `${i * 0.3}s`,
                  animationDuration: '1.5s'
                }}
              />
            ))}
          </div>
        );

      case 'AGO DI PINO':
        return (
          <div className="relative w-96 h-96">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-9xl animate-bounce">⚗️</div>
            </div>
            {/* Poison splashes */}
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className="absolute w-6 h-6 bg-green-500 rounded-full animate-ping"
                style={{
                  left: `${30 + Math.random() * 40}%`,
                  top: `${30 + Math.random() * 40}%`,
                  animationDelay: `${Math.random() * 0.5}s`
                }}
              />
            ))}
          </div>
        );

      case 'ATTACCO KAMIKAZE':
        return (
          <div className="relative w-96 h-96">
            {/* Explosion */}
            <div className="absolute inset-0 bg-gradient-radial from-yellow-300 via-orange-500 to-red-600 rounded-full animate-ping" />
            <div className="absolute inset-0 flex items-center justify-center text-9xl animate-pulse">💥</div>
            {/* Shockwaves */}
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="absolute inset-0 rounded-full border-4 border-yellow-400 animate-ping"
                style={{
                  animationDelay: `${i * 0.2}s`,
                  animationDuration: '1s'
                }}
              />
            ))}
          </div>
        );

      case 'BOMBA SENZA DETONATORE':
        return (
          <div className="relative w-96 h-96">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-9xl animate-bounce">🧨</div>
              <div className="absolute top-20 right-32 text-6xl text-red-500 animate-pulse">❌</div>
            </div>
            {/* Sparks that don't ignite */}
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="absolute w-2 h-2 bg-orange-400 rounded-full opacity-50"
                style={{
                  left: `${40 + i * 3}%`,
                  top: `${30 + (i % 2) * 10}%`,
                  animation: 'twinkle 0.5s ease-in-out infinite',
                  animationDelay: `${i * 0.1}s`
                }}
              />
            ))}
          </div>
        );

      case 'BOMBA':
        return (
          <div className="relative w-96 h-96 animate-shake">
            <div className="absolute inset-0 bg-gradient-radial from-white via-yellow-400 to-red-600 animate-ping" style={{ animationDuration: '0.5s' }} />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-9xl animate-pulse">💣</div>
            </div>
            {/* Explosion particles */}
            {[...Array(30)].map((_, i) => (
              <div
                key={i}
                className="absolute w-8 h-8 bg-orange-500 rounded-full animate-ping"
                style={{
                  left: `${50 + 30 * Math.cos((i * 2 * Math.PI) / 30)}%`,
                  top: `${50 + 30 * Math.sin((i * 2 * Math.PI) / 30)}%`,
                  animationDelay: `${i * 0.05}s`,
                  animationDuration: '1s'
                }}
              />
            ))}
          </div>
        );

      case 'CANZONE NEOMELODICA':
        return (
          <div className="relative w-96 h-96">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-9xl animate-bounce">🎤</div>
            </div>
            {/* Musical notes */}
            {[...Array(12)].map((_, i) => (
              <div
                key={i}
                className="absolute text-6xl animate-pulse"
                style={{
                  left: `${20 + (i % 4) * 20}%`,
                  top: `${10 + Math.floor(i / 4) * 30}%`,
                  animation: 'float-up 2s ease-in-out infinite',
                  animationDelay: `${i * 0.2}s`
                }}
              >
                {i % 2 === 0 ? '♪' : '♫'}
              </div>
            ))}
          </div>
        );

      case 'CIAVATTA':
        return (
          <div className="relative w-96 h-96">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-9xl" style={{ animation: 'slipper-throw 1s ease-out' }}>🩴</div>
            </div>
            {/* Impact effect */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-6xl text-red-500 animate-ping">💥</div>
            </div>
          </div>
        );

      case 'DUELLO':
        return (
          <div className="relative w-96 h-96">
            <div className="absolute left-1/4 top-1/2 -translate-y-1/2 text-8xl animate-pulse">🔫</div>
            <div className="absolute right-1/4 top-1/2 -translate-y-1/2 text-8xl animate-pulse" style={{ transform: 'scaleX(-1) translateY(-50%)' }}>🔫</div>
            {/* Gunfire flashes */}
            <div className="absolute left-1/3 top-1/2 w-16 h-2 bg-yellow-300 animate-ping" />
            <div className="absolute right-1/3 top-1/2 w-16 h-2 bg-yellow-300 animate-ping" style={{ animationDelay: '0.5s' }} />
          </div>
        );

      case 'ESPLOSIONE ATOMICA':
        return (
          <div className="relative w-96 h-96">
            {/* Mushroom cloud */}
            <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-orange-600 via-red-500 to-transparent animate-pulse" />
            <div className="absolute inset-x-0 top-20 h-32 bg-gradient-to-b from-gray-800 via-gray-600 to-transparent rounded-full animate-ping" style={{ animationDuration: '2s' }} />
            <div className="absolute inset-0 flex items-center justify-center text-9xl animate-bounce">☢️</div>
            {/* Shockwave */}
            <div className="absolute inset-0 rounded-full border-8 border-yellow-400 animate-ping" style={{ animationDuration: '1.5s' }} />
          </div>
        );

      case 'FUCILE A POMPA':
        return (
          <div className="relative w-96 h-96">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-9xl">🔫</div>
            </div>
            {/* Muzzle flash */}
            <div className="absolute right-20 top-1/2 -translate-y-1/2 w-32 h-8 bg-yellow-300 animate-ping" style={{ animationDuration: '0.3s' }} />
            {/* Bullet trajectory */}
            <div className="absolute right-10 top-1/2 w-2 h-2 bg-yellow-500 rounded-full animate-ping" />
          </div>
        );

      case 'FURTO':
        return (
          <div className="relative w-96 h-96">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-9xl animate-bounce">🥷</div>
            </div>
            {/* Money bags */}
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="absolute text-6xl"
                style={{
                  left: `${30 + i * 10}%`,
                  bottom: '20%',
                  animation: 'float-up 2s ease-in-out infinite',
                  animationDelay: `${i * 0.2}s`
                }}
              >
                💰
              </div>
            ))}
          </div>
        );

      case 'INFLUENZA':
        return (
          <div className="relative w-96 h-96">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-9xl animate-pulse">🌡️</div>
            </div>
            {/* Germs */}
            {[...Array(15)].map((_, i) => (
              <div
                key={i}
                className="absolute text-4xl animate-bounce"
                style={{
                  left: `${Math.random() * 80 + 10}%`,
                  top: `${Math.random() * 80 + 10}%`,
                  animationDelay: `${Math.random() * 0.5}s`
                }}
              >
                🦠
              </div>
            ))}
          </div>
        );

      case 'LU TRATTORE':
        return (
          <div className="relative w-96 h-96 overflow-hidden">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 text-9xl" style={{ animation: 'tractor-drive 3s linear' }}>
              🚜
            </div>
            {/* Dust clouds */}
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="absolute w-16 h-16 bg-gray-400 rounded-full opacity-50 animate-ping"
                style={{
                  left: `${i * 20}%`,
                  bottom: '30%',
                  animationDelay: `${i * 0.3}s`
                }}
              />
            ))}
          </div>
        );

      case 'MAZZA DA BASEBALL':
        return (
          <div className="relative w-96 h-96">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-9xl" style={{ animation: 'bat-swing 0.8s ease-out' }}>🏏</div>
            </div>
            {/* Impact stars */}
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="absolute text-6xl text-yellow-400 animate-ping"
                style={{
                  left: `${50 + 20 * Math.cos((i * 2 * Math.PI) / 6)}%`,
                  top: `${50 + 20 * Math.sin((i * 2 * Math.PI) / 6)}%`,
                  animationDelay: `${i * 0.1}s`
                }}
              >
                ⭐
              </div>
            ))}
          </div>
        );

      case 'MINA VAGANTE':
        return (
          <div className="relative w-96 h-96">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-9xl" style={{ animation: 'mine-bounce 1s ease-in-out infinite' }}>💣</div>
            </div>
            {/* Danger warning */}
            <div className="absolute inset-0 border-8 border-red-500 animate-pulse" />
            <div className="absolute top-10 left-1/2 -translate-x-1/2 text-6xl animate-bounce">⚠️</div>
          </div>
        );

      case 'MOTOSEGA':
        return (
          <div className="relative w-96 h-96">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-9xl animate-pulse" style={{ animation: 'chainsaw-shake 0.1s linear infinite' }}>🪚</div>
            </div>
            {/* Sawdust particles */}
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className="absolute w-2 h-2 bg-yellow-700 rounded-full animate-ping"
                style={{
                  left: `${40 + Math.random() * 20}%`,
                  top: `${40 + Math.random() * 20}%`,
                  animationDelay: `${Math.random() * 0.5}s`
                }}
              />
            ))}
          </div>
        );

      case 'OMBELICO LANCIAFIAMME':
        return (
          <div className="relative w-96 h-96">
            <div className="absolute inset-0 flex items-center justify-center">
              {/* Flame stream */}
              <div className="w-64 h-32 bg-gradient-to-r from-transparent via-orange-500 to-red-600 animate-pulse" style={{ clipPath: 'polygon(0 50%, 100% 0, 100% 100%)' }} />
            </div>
            <div className="absolute inset-0 flex items-center justify-center text-9xl animate-bounce">🔥</div>
          </div>
        );

      case 'ONDA ENERGETICA':
        return (
          <div className="relative w-96 h-96">
            {/* Kamehameha beam */}
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-32 bg-gradient-to-r from-blue-400 via-cyan-300 to-white animate-pulse" />
            {/* Energy sphere */}
            <div className="absolute left-1/4 top-1/2 -translate-y-1/2 w-24 h-24 bg-blue-400 rounded-full animate-ping" />
            {/* Lightning bolts */}
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="absolute w-1 h-16 bg-yellow-300 animate-pulse"
                style={{
                  left: `${30 + i * 8}%`,
                  top: `${35 + (i % 2) * 20}%`,
                  animationDelay: `${i * 0.1}s`
                }}
              />
            ))}
          </div>
        );

      case 'PADELLATA IN FACCIA':
        return (
          <div className="relative w-96 h-96">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-9xl" style={{ animation: 'pan-hit 0.6s ease-out' }}>🍳</div>
            </div>
            {/* Impact effect */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-8xl text-red-500 animate-ping">💥</div>
            </div>
          </div>
        );

      case 'PARTITA DI TENNIS':
        return (
          <div className="relative w-96 h-96">
            <div className="absolute left-1/4 top-1/2 -translate-y-1/2 text-8xl">🎾</div>
            <div className="absolute right-1/4 top-1/2 -translate-y-1/2 text-8xl">🎾</div>
            {/* Tennis ball */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-6xl" style={{ animation: 'tennis-bounce 0.8s ease-in-out infinite' }}>🎾</div>
          </div>
        );

      case 'PIOGGIA DI METEORITI':
        return (
          <div className="relative w-96 h-96">
            {/* Meteors */}
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className="absolute text-6xl"
                style={{
                  left: `${Math.random() * 90}%`,
                  top: `-10%`,
                  animation: `meteor-fall ${1 + Math.random()}s linear infinite`,
                  animationDelay: `${Math.random() * 2}s`
                }}
              >
                ☄️
              </div>
            ))}
            {/* Explosions on impact */}
            {[...Array(10)].map((_, i) => (
              <div
                key={`exp-${i}`}
                className="absolute text-4xl animate-ping"
                style={{
                  left: `${Math.random() * 80 + 10}%`,
                  bottom: `${Math.random() * 30}%`,
                  animationDelay: `${Math.random() * 2}s`
                }}
              >
                💥
              </div>
            ))}
          </div>
        );

      case 'PRETA':
        return (
          <div className="relative w-96 h-96">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-9xl" style={{ animation: 'rock-throw 1s ease-out' }}>🪨</div>
            </div>
            {/* Impact dust */}
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="absolute w-12 h-12 bg-gray-400 rounded-full opacity-60 animate-ping"
                style={{
                  left: `${40 + (i % 3) * 10}%`,
                  bottom: '20%',
                  animationDelay: `${i * 0.1}s`
                }}
              />
            ))}
          </div>
        );

      case 'PUGNO':
        return (
          <div className="relative w-96 h-96">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-9xl" style={{ animation: 'punch 0.5s ease-out' }}>👊</div>
            </div>
            {/* Impact lines */}
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="absolute w-32 h-1 bg-white animate-ping"
                style={{
                  left: '50%',
                  top: '50%',
                  transform: `rotate(${i * 45}deg)`,
                  transformOrigin: 'left center',
                  animationDelay: `${i * 0.05}s`
                }}
              />
            ))}
          </div>
        );

      case 'ROULETTE RUSSA':
        return (
          <div className="relative w-96 h-96">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-9xl animate-pulse" style={{ animation: 'revolver-spin 2s ease-in-out' }}>🔫</div>
            </div>
            {/* Click sound visual */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-6xl text-gray-500 animate-ping">🔇</div>
            </div>
          </div>
        );

      case 'SAETTA':
        return (
          <div className="relative w-96 h-96">
            {/* Lightning bolt */}
            <div className="absolute inset-x-0 top-0 h-full flex items-center justify-center">
              <div className="w-8 h-full bg-gradient-to-b from-yellow-300 via-white to-blue-400 animate-pulse" style={{ clipPath: 'polygon(50% 0%, 60% 40%, 70% 40%, 40% 100%, 50% 60%, 40% 60%)' }} />
            </div>
            <div className="absolute inset-0 flex items-center justify-center text-9xl animate-pulse">⚡</div>
            {/* Flash effect */}
            <div className="absolute inset-0 bg-white opacity-50 animate-ping" style={{ animationDuration: '0.5s' }} />
          </div>
        );

      default:
        return null;
    }
  };

  const animation = getAnimation();
  if (!animation) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
      <div className="relative">
        {animation}
      </div>
    </div>
  );
};