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
    %tab:* tokens {% ([a,b]) => ({...b, tabs: a.length, viewType: "document"})%} 
  | %tab:* %bullet tokens {% ([a,_,b]) =>  ({...b, tabs: a.length, viewType: "bullet"})%} 
  | %tab:* %numbered tokens {% ([a,_,b]) =>  ({...b, tabs: a.length, viewType: "numbered"})%}
  ) (
   %newLine %newLine %tab:* tokens {% ([_, __, a,b]) =>  ({...b, tabs: a.length, viewType: "document"})%} 
   | %newLine %tab:* %bullet tokens {% ([_,a,__,b]) =>  ({...b, tabs: a.length, viewType: "bullet"})%} 
   | %newLine %tab:* %numbered tokens {% ([_,a,__,b]) =>  ({...b, tabs: a.length, viewType: "numbered"})%}
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
   | %tab {% createTextToken %}
   | %newLine {% createTextToken %}
