@builtin "number.ne"
@builtin "whitespace.ne"
@preprocessor typescript

@{%
import {
   createBoldToken,
   createItalicsToken,
   createStrikethroughToken,
   createTextToken,
   createImageToken,
} from "samepage/utils/atJsonTokens";
import lexer, {
   disambiguateTokens,
   createLinkToken,
   createBlockTokens,
   createEmpty,
} from "./leafLexer";
%}

@lexer lexer

main -> (%tab:* tokens {% ([a,b]) => ({...b, tabs: a.length, viewType: "document"})%} | %tab:* %bullet tokens {% ([a,_,b]) =>  ({...b, tabs: a.length, viewType: "bullet"})%} | %tab:* %numbered tokens {% ([a,_,b]) =>  ({...b, tabs: a.length, viewType: "numbered"})%}) (%newLine %newLine %tab:* tokens {% ([_, __, a,b]) =>  ({...b, tabs: a.length, viewType: "document"})%} | %newLine %tab:* %bullet tokens {% ([_,a,__,b]) =>  ({...b, tabs: a.length, viewType: "bullet"})%} | %newLine %tab:* %numbered tokens {% ([_,a,__,b]) =>  ({...b, tabs: a.length, viewType: "numbered"})%}):* {% createBlockTokens %}

# document -> %tab:* tokens {% ([a,b]) =>  ({...b, tabs: a.length, viewType: "document"})%}

tokens -> token:+ {% disambiguateTokens %} | null {% createEmpty %}

token -> %strike tokens %strike {% createStrikethroughToken %}
   | %boldUnder tokens %boldUnder {% createBoldToken %}
   | %boldStar tokens %boldStar  {% createBoldToken %}
   | %under tokens %under {% createItalicsToken %}
   | %star tokens %star {% createItalicsToken %}
   | %leftBracket tokens %rightBracket %leftParen %url %rightParen {% createLinkToken %}
   | %exclamationMark %leftBracket tokens %rightBracket %leftParen %url %rightParen {% createImageToken %}
   | %text {% createTextToken %}
   | %star  {% createTextToken %}
   | %carot  {% createTextToken %}
   | %tilde  {% createTextToken %}
   | %under  {% createTextToken %}
   | %leftParen {% createTextToken %}
   | %leftBracket {% createTextToken %}
   | %rightParen {% createTextToken %}
   | %rightBracket {% createTextToken %}
   | %exclamationMark {% createTextToken %}
   | %leftBracket %rightBracket %leftParen %url %rightParen {% createTextToken %}
   | %tab {% createTextToken %}
   | %newLine {% createTextToken %}
