import React from 'react';
import { ScrollVideoBackground } from './ScrollVideoBackground';

/**
 * Camada visual de fundo (carregada via React.lazy no App): o vídeo do burger
 * em tela cheia, montado no topo e explodindo conforme a rolagem.
 */
const BackgroundExperience: React.FC = () => <ScrollVideoBackground />;

export default BackgroundExperience;
