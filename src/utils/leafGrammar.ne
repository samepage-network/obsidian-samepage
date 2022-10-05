@builtin "number.ne"
@builtin "whitespace.ne"
@preprocessor typescript

@{%
import {
   createBoldToken,
   createItalicsToken,
   createLinkToken,
   createStrikethroughToken,
   createTextToken,
   createImageToken,
   disambiguateTokens,
} from "samepage/utils/atJsonTokens";
import lexer, {
   createBlockTokens,
   createEmpty,
} from "./leafLexer";
%}

@lexer lexer

main -> ( %tab:* tokens %newLine {% ([a,b]) =>  ({...b, tabs: a.length})%} | %tab:* %newLine {% createEmpty %}):* (%tab:* tokens {% ([a,b]) =>  ({...b, tabs: a.length})%}):? {% createBlockTokens %}

tokens -> token:+ {% disambiguateTokens %}

token -> %strike tokens %strike {% createStrikethroughToken %}
   | %boldUnder tokens %boldUnder {% createBoldToken %}
   | %boldStar tokens %boldStar  {% createBoldToken %}
   | %under tokens %under {% createItalicsToken %}
   | %star tokens %star {% createItalicsToken %}
   | %leftBracket tokens %rightBracket %leftParen %url %rightParen {% createLinkToken %}
   | %exclamationMark %leftBracket (tokens {% id %} | null {% id %}) %rightBracket %leftParen %url %rightParen {% createImageToken %}
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
