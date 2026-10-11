import React, { ReactNode } from 'react';
import { Dialog, DialogCloseButton } from '../ui/Dialog';
import { STORE, STORE_LOCATION } from '../../../shared/storeConfig';
import { openCookiePreferences } from '../../lib/consent';
import { IFOOD_URL } from '../../lib/config';

/**
 * Textos legais (LGPD – Lei 13.709/2018, Marco Civil – Lei 12.965/2014, CDC).
 *
 * ATENÇÃO: este é um modelo técnico fiel ao que o site faz HOJE. Antes de
 * divulgar, peça a um(a) advogado(a) para revisar. Sempre que o site passar a
 * coletar algo novo (formulário, analytics, pixel de anúncios, chat humano...),
 * atualize LAST_UPDATED e o texto — e suba CONSENT_VERSION em shared/consent.ts
 * para o banner voltar a perguntar.
 */
export type LegalDoc = 'privacidade' | 'cookies' | 'termos';

const LAST_UPDATED = '11 de outubro de 2026';

export const LEGAL_TITLES: Record<LegalDoc, string> = {
  privacidade: 'Política de Privacidade',
  cookies: 'Política de Cookies',
  termos: 'Termos de Uso',
};

const H: React.FC<{ children: ReactNode }> = ({ children }) => (
  <h3 className="text-sm font-bold text-white uppercase tracking-wider font-sans pt-2">{children}</h3>
);
const P: React.FC<{ children: ReactNode }> = ({ children }) => <p>{children}</p>;
const UL: React.FC<{ children: ReactNode }> = ({ children }) => <ul className="list-disc pl-5 space-y-1.5">{children}</ul>;

const contactLine = STORE.privacyEmail
  ? `e-mail ${STORE.privacyEmail} ou WhatsApp/telefone ${STORE.phoneDisplay}`
  : `WhatsApp/telefone ${STORE.phoneDisplay}`;

const Controller: React.FC = () => (
  <P>
    <strong className="text-white">Controlador dos dados:</strong> {STORE.name}, CNPJ {STORE.cnpj}, {STORE_LOCATION}. Contato
    para assuntos de privacidade: {contactLine}.
  </P>
);

const Privacidade: React.FC = () => (
  <>
    <Controller />
    <H>1. O que este site coleta</H>
    <P>
      Este site é uma vitrine: você vê o cardápio e faz o pedido no iFood. Por isso <strong className="text-white">não
      temos cadastro, login nem formulário de pedido</strong> e não pedimos seu nome, telefone, endereço ou pagamento aqui.
    </P>
    <UL>
      <li>
        <strong className="text-white">Carrinho (no seu aparelho):</strong> os itens que você escolhe ficam salvos só no seu
        navegador (armazenamento local) e nunca são enviados a nós. Serve apenas para você montar e copiar o resumo do pedido.
      </li>
      <li>
        <strong className="text-white">Escolha de cookies:</strong> guardamos no seu navegador a decisão que você tomou no
        banner e a data, para não perguntar de novo a cada visita.
      </li>
      <li>
        <strong className="text-white">Assistente de pedidos e Studio IA (opcionais):</strong> o que você digita nesses
        recursos é enviado ao nosso servidor e ao Google (API Gemini) apenas para gerar a resposta. Não digite dados pessoais,
        senhas ou números de documentos ali.
      </li>
      <li>
        <strong className="text-white">Dados técnicos de acesso:</strong> para proteger o site contra abusos, o endereço IP é
        usado temporariamente na memória do servidor (limite de requisições). Nosso provedor de hospedagem também pode
        registrar acessos (IP, data, navegador) por segurança.
      </li>
    </UL>
    <H>2. Para que usamos (bases legais)</H>
    <UL>
      <li>Fazer o site funcionar e protegê-lo contra fraudes e ataques — legítimo interesse (art. 7º, IX) e execução do serviço.</li>
      <li>Estatísticas e marketing — somente com o seu consentimento (art. 7º, I), que você pode retirar a qualquer momento.</li>
      <li>Responder o assistente de IA — execução do serviço que você solicitou ao usá-lo.</li>
    </UL>
    <H>3. Com quem compartilhamos</H>
    <UL>
      <li>
        <strong className="text-white">iFood:</strong> ao clicar em “Pedir no iFood” você sai deste site e passa a ser
        atendido pelo iFood, que é responsável pelos dados do seu pedido, entrega e pagamento, conforme a política de
        privacidade dele.
      </li>
      <li>
        <strong className="text-white">Google (Gemini):</strong> processa as mensagens do assistente/Studio IA. Isso pode
        envolver transferência internacional de dados (art. 33), com as garantias contratuais do provedor.
      </li>
      <li>
        <strong className="text-white">Unsplash:</strong> várias fotos do cardápio são carregadas dos servidores do Unsplash,
        que recebe o seu IP ao entregá-las.
      </li>
      <li>Provedor de hospedagem do site, como operador, para manter o site no ar.</li>
    </UL>
    <P>Não vendemos seus dados.</P>
    <H>4. Por quanto tempo guardamos</H>
    <P>
      Carrinho e escolha de cookies ficam no seu aparelho até você limpá-los (a escolha de cookies é renovada a cada 180
      dias). Registros técnicos de segurança são mantidos pelo tempo necessário para proteger o site e cumprir obrigações
      legais (o Marco Civil da Internet prevê guarda de registros de acesso a aplicações por 6 meses).
    </P>
    <H>5. Seus direitos (art. 18 da LGPD)</H>
    <P>
      Você pode pedir confirmação de tratamento, acesso, correção, anonimização, eliminação, portabilidade, informação sobre
      compartilhamentos e revogação de consentimento. Fale conosco: {contactLine}. Também pode reclamar à Autoridade Nacional
      de Proteção de Dados (gov.br/anpd).
    </P>
    <P>
      Para apagar o que está no seu aparelho: esvazie o carrinho no site e limpe os dados do site no navegador. Para mudar
      cookies:{' '}
      <button type="button" onClick={openCookiePreferences} className="underline underline-offset-2 text-amber-300 cursor-pointer">
        Preferências de cookies
      </button>
      .
    </P>
    <H>6. Crianças</H>
    <P>O site não é direcionado a menores de 12 anos e não coleta dados de crianças conscientemente.</P>
    <H>7. Segurança</H>
    <P>
      Usamos conexão criptografada (HTTPS), política de segurança de conteúdo restritiva, limites contra abuso e validação de
      tudo que chega ao servidor. Nenhum sistema é 100% invulnerável; se identificarmos incidente que possa causar risco
      relevante, comunicaremos você e a ANPD, conforme a lei.
    </P>
    <H>8. Mudanças</H>
    <P>Podemos atualizar esta política; a data no topo mostra a última revisão. Mudanças relevantes reativam o aviso de cookies.</P>
  </>
);

const Cookies: React.FC = () => (
  <>
    <Controller />
    <P>
      Cookies e armazenamento local são pequenos dados guardados no seu navegador. Dividimos em categorias e só ativamos as
      opcionais com a sua permissão.
    </P>
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[11px] border border-white/10">
        <thead className="bg-white/5 text-white">
          <tr>
            <th className="p-2">Nome</th>
            <th className="p-2">Categoria</th>
            <th className="p-2">Para que serve</th>
            <th className="p-2">Duração</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          <tr>
            <td className="p-2 font-mono">sc_cookie_consent</td>
            <td className="p-2">Necessário</td>
            <td className="p-2">Lembra a sua escolha neste banner.</td>
            <td className="p-2">180 dias</td>
          </tr>
          <tr>
            <td className="p-2 font-mono">sao-cristovao-cart:v1</td>
            <td className="p-2">Necessário</td>
            <td className="p-2">Guarda os itens do carrinho no seu aparelho. Não é enviado a ninguém.</td>
            <td className="p-2">Até você limpar</td>
          </tr>
        </tbody>
      </table>
    </div>
    <P>
      <strong className="text-white">Estatísticas e marketing:</strong> hoje nenhum rastreador dessas categorias está
      instalado. Se isso mudar, ele só será carregado depois de você permitir, e esta tabela será atualizada.
    </P>
    <H>Como mudar sua escolha</H>
    <P>
      Clique em{' '}
      <button type="button" onClick={openCookiePreferences} className="underline underline-offset-2 text-amber-300 cursor-pointer">
        Preferências de cookies
      </button>{' '}
      (também no rodapé do site). Você ainda pode bloquear ou apagar cookies pelas configurações do navegador; sem o
      armazenamento necessário, o carrinho não será lembrado.
    </P>
    <P>Para mais detalhes sobre dados pessoais, veja a <a href="#privacidade" className="underline text-amber-300">Política de Privacidade</a>.</P>
  </>
);

const Termos: React.FC = () => (
  <>
    <P>
      Ao usar este site você concorda com estes termos. O site é mantido por {STORE.name}, CNPJ {STORE.cnpj}, {STORE_LOCATION}.
    </P>
    <H>1. O que é o site</H>
    <P>
      Vitrine digital do cardápio da {STORE.name}. Os pedidos, pagamentos e entregas são realizados pelo{' '}
      <a href={IFOOD_URL} target="_blank" rel="noopener noreferrer" className="underline text-amber-300">
        iFood
      </a>
      , que tem termos próprios. Preços, promoções, taxas, tempo de entrega e disponibilidade exibidos no iFood prevalecem sobre
      os deste site.
    </P>
    <H>2. Informações do cardápio</H>
    <P>
      Fazemos o possível para manter descrições, preços e fotos corretos, mas podem ocorrer divergências. As fotos são ilustrativas.
      Se você tem alergia ou restrição alimentar, avise-nos antes de pedir — os produtos são preparados em cozinha que manipula
      glúten, leite, ovos e outros alérgenos.
    </P>
    <H>3. Assistente e Studio IA</H>
    <P>
      São recursos de apoio e podem errar. Imagens geradas são ilustrações e não representam o produto real. Não use esses recursos
      para conteúdo ilegal, ofensivo ou que viole direitos de terceiros, nem tente sobrecarregar ou atacar o site; acessos abusivos
      podem ser bloqueados.
    </P>
    <H>4. Propriedade intelectual</H>
    <P>Marca, logotipo, textos, imagens e design pertencem à {STORE.name} ou a seus licenciantes. Não é permitido copiá-los sem autorização.</P>
    <H>5. Responsabilidade</H>
    <P>
      Empregamos medidas de segurança razoáveis, mas não garantimos disponibilidade ininterrupta do site. Isso não limita os direitos
      que o Código de Defesa do Consumidor assegura a você.
    </P>
    <H>6. Lei aplicável e foro</H>
    <P>Aplica-se a lei brasileira. Fica eleito o foro do domicílio do consumidor, conforme o CDC.</P>
  </>
);

const BODY: Record<LegalDoc, React.FC> = { privacidade: Privacidade, cookies: Cookies, termos: Termos };

interface LegalDialogProps {
  doc: LegalDoc;
  onClose: () => void;
}

const LegalDialog: React.FC<LegalDialogProps> = ({ doc, onClose }) => {
  const Body = BODY[doc];
  const titleId = 'legal-title';
  return (
    <Dialog
      onClose={onClose}
      labelledBy={titleId}
      panelClassName="w-full max-w-2xl my-auto bg-[#121216] border border-white/10 rounded-3xl shadow-2xl flex flex-col max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)]"
    >
      <div className="p-5 sm:p-6 border-b border-white/10 flex items-start justify-between gap-3">
        <div>
          <h2 id={titleId} className="text-lg sm:text-xl font-extrabold text-white font-display">
            {LEGAL_TITLES[doc]}
          </h2>
          <p className="text-[11px] text-zinc-400 mt-0.5">Atualizado em {LAST_UPDATED}</p>
        </div>
        <DialogCloseButton onClose={onClose} label="Fechar" />
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-5 sm:p-6 space-y-3 text-xs sm:text-[13px] leading-relaxed text-zinc-300">
        <Body />
      </div>
    </Dialog>
  );
};

export default LegalDialog;
