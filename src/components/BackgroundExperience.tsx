import React from "react";
import { ScrollSequenceBackground } from "./ScrollSequenceBackground";

/**
 * Camada visual de fundo (carregada via React.lazy no App): o burger em tela
 * cheia, montado no topo e explodindo conforme a rolagem.
 */
const BackgroundExperience: React.FC = () => <ScrollSequenceBackground />;

export default BackgroundExperience;
