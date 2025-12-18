// utils/get-game-thumbnails.ts

export const getThumbnail = (slug: string) => {
  const thumbnails: { [key: string]: any } = {
    "mojicon-winter-connect": require("../assets/game-thumbnails/mojicon-winter-connect.jpg"),
    "magic-christmas-tree-match-3": require("../assets/game-thumbnails/magic-christmas-tree-match-3.jpg"),
    "2-player-battle": require("../assets/game-thumbnails/2-player-battle.jpg"),
    "obby-rainbow-tower": require("../assets/game-thumbnails/obby-rainbow-tower.jpg"),
    "crazy-traffic-racer-1": require("../assets/game-thumbnails/crazy-traffic-racer-1.jpg"),
    "ocean-pop": require("../assets/game-thumbnails/ocean-pop.jpg"),
    "dynamons-connect": require("../assets/game-thumbnails/dynamons-connect.jpg"),
    "my-arcade-center-1": require("../assets/game-thumbnails/my-arcade-center-1.jpg"),
    "what-a-walk": require("../assets/game-thumbnails/what-a-walk.jpg"),
    "word-connect-puzzle": require("../assets/game-thumbnails/word-connect-puzzle.jpg"),
    "radical-rappelling": require("../assets/game-thumbnails/radical-rappelling.jpg"),
    hypermarket: require("../assets/game-thumbnails/hypermarket.jpg"),
    "obby-modes-online-mini-games": require("../assets/game-thumbnails/obby-modes-online-mini-games.jpg"),
    "pipe-connect": require("../assets/game-thumbnails/pipe-connect.jpg"),
    "ocean-kids-back-to-school": require("../assets/game-thumbnails/ocean-kids-back-to-school.jpg"),
    "urus-city-driver": require("../assets/game-thumbnails/urus-city-driver.jpg"),
    "mega-jump": require("../assets/game-thumbnails/mega-jump.jpg"),
    "ping-pong-air": require("../assets/game-thumbnails/ping-pong-air.jpg"),
    "k-pop-hunter-fashion": require("../assets/game-thumbnails/k-pop-hunter-fashion.jpg"),
    "cooking-restaurant-kitchen": require("../assets/game-thumbnails/cooking-restaurant-kitchen.jpg"),
  };

  return (
    thumbnails[slug] ||
    require("../assets/game-thumbnails/mojicon-winter-connect.jpg")
  ); // fallback image
};
