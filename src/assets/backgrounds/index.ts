import connectionManagerUrl from "./background_connection_manager.jpg";
import gerardUrl from "./background_gerard-v-DT4W3TF60mk-unsplash.jpg";
import ivanUrl from "./background_ivan-rohovchenko-7nHfMD8XZko-unsplash.jpg";
import mohammadrezaUrl from "./background_mohammadreza-azali-TQlM5HxHqEc-unsplash.jpg";

export type AppBackground = {
  id: string;
  label: string;
  imageUrl: string;
};

export const appBackgrounds: AppBackground[] = [
  {
    id: "connection-manager",
    label: "Connection Manager",
    imageUrl: connectionManagerUrl,
  },
  {
    id: "gerard-coast",
    label: "Gerard Coast",
    imageUrl: gerardUrl,
  },
  {
    id: "ivan-cliffs",
    label: "Ivan Cliffs",
    imageUrl: ivanUrl,
  },
  {
    id: "mohammadreza-horizon",
    label: "Mohammadreza Horizon",
    imageUrl: mohammadrezaUrl,
  },
];

export function getRandomAppBackground() {
  return appBackgrounds[Math.floor(Math.random() * appBackgrounds.length)] ?? appBackgrounds[0];
}
