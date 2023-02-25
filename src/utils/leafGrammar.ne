@preprocessor typescript

@{%
import {
   createStrikethroughToken,
   createTextToken,
   createImageToken,
} from "samepage/utils/atJsonTokens";
import lexer, {
   createBoldToken,
   createItalicsToken,
   disambiguateTokens,
   createBlockTokens,
   createEmpty,
   createReferenceToken,
   createNull,
   createAssetToken,
   createAliasToken,
   createCodeBlockToken,
} from "./leafLexer";
%}

@lexer lexer

main -> (
    %tab:* tokens {% ([tabs,b]) => ({...b, tabs, viewType: "document"})%} 
  | %initialBullet tokens {% ([tabs,b]) =>  ({...b, tabs, viewType: "bullet"})%} 
  | %initialNumbered tokens {% ([tabs,b]) =>  ({...b, tabs, viewType: "numbered"})%}
  ) (
   %paragraph tokens {% ([tabs,b]) =>  ({...b, tabs, viewType: "document"})%} 
   | %bullet tokens {% ([tabs,b]) =>  ({...b, tabs, viewType: "bullet"})%} 
   | %numbered tokens {% ([tabs,b]) =>  ({...b, tabs, viewType: "numbered"})%}
  ):* {% createBlockTokens %}

tokens -> token:+ {% disambiguateTokens %} | null {% createEmpty %}

token -> %openDoubleTilde (tokens {% id %} | null {% createNull %}) (%strike | %openDoubleTilde) {% createStrikethroughToken %}
   | %openDoubleUnder (tokens {% id %} | null {% createNull %}) (%boldUnder | %openDoubleUnder) {% createBoldToken %}
   | %openDoubleStar (tokens {% id %} | null {% createNull %}) (%boldStar | %openDoubleStar)  {% createBoldToken %}
   | %openUnder tokens (%under | %openUnder) {% createItalicsToken %}
   | %openStar tokens (%star | %openStar) {% createItalicsToken %}
   | %alias {% createAliasToken %}
   | %asset {% createAssetToken %}
   | %codeBlock {% createCodeBlockToken %}
   | %exclamationMark %leftBracket tokens %rightBracket %leftParen %url %rightParen {% createImageToken %}
   | %reference {% createReferenceToken %}
   | %text {% createTextToken %}
   | %star  {% createTextToken %}
   | %carot  {% createTextToken %}
   | %tilde  {% createTextToken %}
   | %under  {% createTextToken %}
   | %boldStar {% createTextToken %}
   | %boldUnder {% createTextToken %}
   | %strike {% createTextToken %}
   | %leftParen {% createTextToken %}
   | %leftBracket {% createTextToken %}
   | %rightParen {% createTextToken %}
   | %rightBracket {% createTextToken %}
   | %exclamationMark {% createTextToken %}
   | %leftBracket %rightBracket %leftParen %url %rightParen {% createTextToken %}
   | %url {% createTextToken %}
   | %tab {% createTextToken %}
   | %newLine {% createTextToken %}
